use std::{
    io::Read,
    sync::Arc,
};
use tauri::{AppHandle, Emitter};
use tauri::Manager;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::ws::WsHub;

// (placeholder) server_args will be used by protocol-level client
// use super::device::server_args;

/// Render a scrcpy codec_id FourCC as a short string for logs.
///
/// scrcpy 3.x encodes `codec_id` as a 4-byte ASCII FourCC in big-endian order.
/// Known video codecs: `h264` (0x68323634), `h265` (0x68323635), `\x00av1`
/// (0x00617631). Unknown values render in hex.
pub(crate) fn parse_codec_fourcc(bytes: &[u8]) -> String {
    if bytes.len() < 4 {
        return format!("<{} bytes>", bytes.len());
    }
    let b = &bytes[0..4];
    if b.iter().all(|&c| c.is_ascii_graphic() || c == b' ') {
        // All printable → render as the ASCII it is
        String::from_utf8_lossy(b).to_string()
    } else if b[0] == 0 && b[1..].iter().all(|&c| c.is_ascii_graphic()) {
        // "\x00av1" style — show the printable suffix
        String::from_utf8_lossy(&b[1..]).to_string()
    } else {
        format!("0x{:02x}{:02x}{:02x}{:02x}", b[0], b[1], b[2], b[3])
    }
}

pub type StreamTokens = Arc<Mutex<std::collections::HashMap<String, CancellationToken>>>;
pub struct ControlEntry {
    pub stream: std::net::TcpStream,
    pub video_width: u32,
    pub video_height: u32,
}

pub type ControlSockets = Arc<std::sync::Mutex<std::collections::HashMap<String, ControlEntry>>>;

pub fn new_tokens() -> StreamTokens {
    Arc::new(Mutex::new(std::collections::HashMap::new()))
}

pub fn new_control_sockets() -> ControlSockets {
    Arc::new(std::sync::Mutex::new(std::collections::HashMap::new()))
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct StreamOptions {
    pub max_size: u32,
    pub max_fps: u32,
    pub bit_rate: u32,
}

impl Default for StreamOptions {
    fn default() -> Self {
        Self {
            max_size: 720,
            max_fps: 30,
            bit_rate: 4_000_000,
        }
    }
}

/// Start a scrcpy-based video stream.
///
/// This currently records to stdout as an MKV stream, then decodes frames and emits JPEG data.
///
/// Notes:
/// - Control is intentionally disabled (Phase 1).
/// - For simplicity, we emit JPEG base64 via a Tauri event; this can later be optimized to binary.
pub async fn start_stream_loop(
    tokens: StreamTokens,
    control_sockets: ControlSockets,
    serial: String,
    host: String,
    port: u16,
    opts: StreamOptions,
    app: AppHandle,
) {
    println!(
        "[STREAM] start_stream_loop serial={} server={}:{} opts={{max_size={}, max_fps={}, bit_rate={}}}",
        serial, host, port, opts.max_size, opts.max_fps, opts.bit_rate
    );
    let token = CancellationToken::new();
    {
        let mut map = tokens.lock().await;
        if let Some(old) = map.insert(serial.clone(), token.clone()) {
            old.cancel();
        }
    }

    let local_port = super::scrcpy_client::scrcpy_local_port(&serial);
    let _ = app.emit("stream-status", serde_json::json!({"serial": serial, "status": "starting"}));

    let serial_clone = serial.clone();
    let host_clone = host.clone();
    let scrcpy_conn = match tokio::task::spawn_blocking(move || {
        super::scrcpy_client::start_scrcpy_and_connect(&serial_clone, &host_clone, port, local_port, &opts)
    }).await {
        Ok(Ok(c)) => c,
        Ok(Err(e)) => {
            let _ = app.emit("stream-status", serde_json::json!({"serial": serial, "status": "error", "error": e}));
            let _ = app.emit(
                "stream-error",
                serde_json::json!({ "serial": serial, "error": e }),
            );
            return;
        }
        Err(e) => {
            let msg = format!("bootstrap task panicked: {e}");
            let _ = app.emit("stream-status", serde_json::json!({"serial": serial, "status": "error", "error": msg}));
            return;
        }
    };

    let _ = app.emit("stream-status", serde_json::json!({"serial": serial, "status": "connected"}));
    let stdout = scrcpy_conn.stream;
    let mut server_child = scrcpy_conn.server_child;
    let _scid = scrcpy_conn.scid;

    if let Some(ctrl) = scrcpy_conn.control {
        control_sockets.lock().unwrap().insert(serial.clone(), ControlEntry {
            stream: ctrl,
            video_width: 0,
            video_height: 0,
        });
    }

    let serial_for_task = serial.clone();
    let token_for_task = token.clone();
    let app_for_task = app.clone();
    let hub = app.state::<WsHub>().inner().clone();
    let cs_for_task = Arc::clone(&control_sockets);
    let forward_task = tokio::task::spawn_blocking(move || {
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            forward_h264_to_ws(stdout, &serial_for_task, &token_for_task, &app_for_task, &hub, &cs_for_task)
        }));

        match res {
            Ok(Ok(())) => {}
            Ok(Err(e)) => {
                let _ = app_for_task.emit(
                    "stream-error",
                    serde_json::json!({ "serial": serial_for_task, "error": e }),
                );
            }
            Err(_) => {
                let _ = app_for_task.emit(
                    "stream-error",
                    serde_json::json!({ "serial": serial_for_task, "error": "panic in stream forward" }),
                );
            }
        }
    });

    token.cancelled().await;

    let _ = server_child.kill();

    let local_port = super::scrcpy_client::scrcpy_local_port(&serial);
    let _ = std::process::Command::new("adb")
        .args(["-s", &serial, "forward", "--remove", &format!("tcp:{}", local_port)])
        .output();

    let _ = forward_task.await;
}

pub async fn stop_stream_loop(tokens: StreamTokens, control_sockets: ControlSockets, serial: &str) {
    control_sockets.lock().unwrap().remove(serial);
    let mut map = tokens.lock().await;
    if let Some(token) = map.remove(serial) {
        token.cancel();
    }
}

/// Forward raw H.264 packets from the scrcpy stream to the WebSocket hub.
///
/// Instead of decoding H.264 and re-encoding as JPEG, we send the raw NAL
/// units to the frontend where WebCodecs `VideoDecoder` handles GPU decoding.
fn forward_h264_to_ws<R: Read + Send + 'static>(
    mut input: R,
    serial: &str,
    token: &CancellationToken,
    app: &AppHandle,
    hub: &WsHub,
    control_sockets: &ControlSockets,
) -> Result<(), String> {
    let mut buf: Vec<u8> = Vec::new();
    let mut chunk = [0u8; 64 * 1024];

    let mut dummy_consumed = false;
    let mut codec_meta_consumed = false;
    let mut video_width: u32 = 0;
    let mut video_height: u32 = 0;
    let mut invalid_header_hits: u32 = 0;
    let mut first_data_at: Option<std::time::Instant> = None;
    let loop_start = std::time::Instant::now();
    let mut last_idle_log: Option<std::time::Instant> = None;
    let mut last_config: Option<Vec<u8>> = None;

    println!("[SCRCPY-FWD] entering read loop serial={}", serial);

    while !token.is_cancelled() {
        let n = match input.read(&mut chunk) {
            Ok(0) => {
                println!("[SCRCPY-FWD] stream EOF serial={} after {:?}", serial, loop_start.elapsed());
                break;
            }
            Ok(n) => n,
            Err(e)
                if e.kind() == std::io::ErrorKind::WouldBlock
                    || e.kind() == std::io::ErrorKind::TimedOut =>
            {
                let now = std::time::Instant::now();
                let should_log = last_idle_log
                    .map(|t| now.duration_since(t) >= std::time::Duration::from_secs(5))
                    .unwrap_or(true);
                if should_log && first_data_at.is_none() {
                    last_idle_log = Some(now);
                    println!(
                        "[SCRCPY-FWD] no bytes from server serial={} waited={:?}",
                        serial, loop_start.elapsed()
                    );
                }
                continue;
            }
            Err(e) => return Err(format!("read scrcpy stream failed: {e}")),
        };

        if first_data_at.is_none() {
            first_data_at = Some(std::time::Instant::now());
            println!("[SCRCPY-FWD] first bytes serial={} n={}", serial, n);
            let _ = app.emit("stream-status", serde_json::json!({"serial": serial, "status": "receiving"}));
        }
        buf.extend_from_slice(&chunk[..n]);

        if !dummy_consumed && !buf.is_empty() {
            if buf[0] == 0 {
                buf.drain(..1);
            }
            dummy_consumed = true;
        }
        if dummy_consumed && !codec_meta_consumed && buf.len() >= 12 {
            let fourcc = parse_codec_fourcc(&buf[0..4]);
            video_width = u32::from_be_bytes(buf[4..8].try_into().unwrap());
            video_height = u32::from_be_bytes(buf[8..12].try_into().unwrap());
            println!(
                "[SCRCPY-FWD] codec meta serial={} codec={} w={} h={}",
                serial, fourcc, video_width, video_height
            );
            if let Ok(mut sockets) = control_sockets.lock() {
                if let Some(entry) = sockets.get_mut(serial) {
                    entry.video_width = video_width;
                    entry.video_height = video_height;
                    println!("[SCRCPY-FWD] updated control socket video size serial={} {}x{}", serial, video_width, video_height);
                }
            }
            buf.drain(..12);
            codec_meta_consumed = true;
        }

        if !codec_meta_consumed {
            continue;
        }

        while buf.len() >= 12 {
            let pts_raw = u64::from_be_bytes(buf[0..8].try_into().unwrap());
            let packet_size = u32::from_be_bytes(buf[8..12].try_into().unwrap()) as usize;
            if packet_size == 0 {
                buf.drain(..12);
                continue;
            }
            if packet_size > 10 * 1024 * 1024 {
                invalid_header_hits = invalid_header_hits.saturating_add(1);
                if invalid_header_hits % 2000 == 1 {
                    let head_len = std::cmp::min(16, buf.len());
                    let mut hex = String::new();
                    for b in &buf[..head_len] {
                        use std::fmt::Write as _;
                        let _ = write!(&mut hex, "{:02x}", b);
                    }
                    println!(
                        "[SCRCPY-FWD] invalid header serial={} buf_len={} head={}...",
                        serial, buf.len(), hex
                    );
                }
                buf.drain(..1);
                continue;
            }

            invalid_header_hits = 0;
            if buf.len() < 12 + packet_size {
                break;
            }

            let is_config = (pts_raw >> 63) & 1 == 1;
            let is_key = (pts_raw >> 62) & 1 == 1;
            let pts = pts_raw & 0x3FFF_FFFF_FFFF_FFFF;

            let nal_data = &buf[12..12 + packet_size];

            if is_config {
                // Config packet — cache and forward as type 0
                last_config = Some(nal_data.to_vec());
                let packed = WsHub::pack_h264_frame(serial, 0, pts, video_width, video_height, nal_data);
                hub.broadcast(serial, packed);
            } else {
                let packet_type = if is_key { 1u8 } else { 2 };
                // For keyframes, prepend the last config (SPS/PPS) so the
                // decoder can be (re-)configured even if it missed the
                // initial config packet due to late WS subscription.
                if is_key {
                    if let Some(ref cfg) = last_config {
                        let packed = WsHub::pack_h264_frame(serial, 0, pts, video_width, video_height, cfg);
                        hub.broadcast(serial, packed);
                    }
                }
                let packed = WsHub::pack_h264_frame(serial, packet_type, pts, video_width, video_height, nal_data);
                hub.broadcast(serial, packed);
            }

            buf.drain(..12 + packet_size);
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_codec_fourcc_h264() {
        // scrcpy 3.x codec_id for H.264 is the ASCII FourCC "h264".
        let bytes = [0x68u8, 0x32, 0x36, 0x34];
        assert_eq!(parse_codec_fourcc(&bytes), "h264");
    }

    #[test]
    fn parse_codec_fourcc_h265() {
        let bytes = [0x68u8, 0x32, 0x36, 0x35];
        assert_eq!(parse_codec_fourcc(&bytes), "h265");
    }

    #[test]
    fn parse_codec_fourcc_av1() {
        // AV1 uses a leading NUL: "\x00av1" (0x00617631).
        let bytes = [0x00u8, 0x61, 0x76, 0x31];
        assert_eq!(parse_codec_fourcc(&bytes), "av1");
    }

    #[test]
    fn parse_codec_fourcc_h264_is_not_in_1_to_3() {
        // Regression guard: the old code used `(1..=3).contains(&codec_id)`
        // which never matched because the FourCC is a large integer, so
        // codec meta was never drained.
        let codec_id = u32::from_be_bytes([0x68, 0x32, 0x36, 0x34]);
        assert!(!(1..=3).contains(&codec_id), "h264 FourCC = {codec_id} must not match the old 1..=3 check");
    }

    #[test]
    fn parse_codec_fourcc_unknown_renders_hex() {
        let bytes = [0x01u8, 0x02, 0x03, 0x04];
        assert_eq!(parse_codec_fourcc(&bytes), "0x01020304");
    }

    #[test]
    fn parse_codec_fourcc_short_bytes() {
        assert_eq!(parse_codec_fourcc(&[0x68, 0x32]), "<2 bytes>");
    }
}
