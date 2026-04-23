# Video Streaming & Concurrency Optimization Plan

## P0 - H.264 Direct Pass-through + WebCodecs Frontend Decoding

**Status**: [x] DONE

**Problem**: Current pipeline `H.264 → FFmpeg decode → RGB → JPEG encode → WS → browser Blob URL → <img>` adds 50-100ms latency per frame, consumes heavy CPU per device, and doesn't scale.

**Solution**: Send raw H.264 NAL units via WebSocket to frontend, use WebCodecs `VideoDecoder` for GPU-accelerated decoding, render to `<canvas>`.

**Benefit**: Latency -50~100ms, CPU -80%+, remove FFmpeg dependency for decoding path, each device becomes async IO (not blocking thread).

**Files**:
- `src-tauri/src/adb/stream.rs` — replace JPEG encode with H.264 packet forwarding
- `src-tauri/src/ws.rs` — binary frame format change (H.264 NAL)
- `src/hooks/useStream.ts` — WebCodecs VideoDecoder + canvas rendering
- `src/components/DeviceGrid/DeviceCard.tsx` — `<canvas>` instead of `<img>`
- `src-tauri/Cargo.toml` — remove `image` crate dependency (if no longer needed)

---

## P1a - Async scrcpy Bootstrap + Parallel Device Startup

**Status**: [x] DONE

**Problem**: `start_scrcpy_and_connect` is fully synchronous with multiple `thread::sleep` calls (total up to 13s per device). 50 devices start serially = minutes.

**Solution**: Convert to async with `tokio::process::Command`, parallel startup via `tokio::spawn`.

**Benefit**: 50-device startup from minutes to seconds.

**Files**:
- `src-tauri/src/adb/scrcpy_client.rs` — sync → async conversion
- `src-tauri/src/adb/stream.rs` — caller adjustment

---

## P1b - Parallel ADB Group Control Commands

**Status**: [x] DONE

**Problem**: `tap_devices` / `swipe_devices` etc. execute sequentially via `.iter().map()`. N devices × 3s timeout = N×3s worst case.

**Solution**: Use `tokio::spawn` or `rayon` to parallelize ADB shell calls.

**Benefit**: Group control latency from O(N) to O(1).

**Files**:
- `src-tauri/src/lib.rs` — `tap_devices`, `swipe_devices`, `send_text_devices`, `keyevent_devices`, `wake_up_devices`
- `src-tauri/src/adb/commands.rs` — optionally convert to async

---

## P2a - Parallel Device Info Fetching

**Status**: [x] DONE

**Problem**: `fetch_device_info` runs 3 sequential adb shell commands (wm size, getprop, dumpsys battery) per device.

**Solution**: Run the 3 commands concurrently per device.

**Benefit**: Device discovery 3× faster.

**Files**:
- `src-tauri/src/adb/server.rs` — `fetch_device_info`

---

## P2b - WebSocket Broadcast Zero-Copy

**Status**: [x] DONE

**Problem**: `hub.broadcast()` clones full frame data for each subscriber.

**Solution**: Use `bytes::Bytes` (reference-counted) instead of `Vec<u8>`.

**Benefit**: Eliminate per-subscriber memory copy.

**Files**:
- `src-tauri/src/ws.rs` — `WsHub::broadcast`, `pack_jpeg_frame`
- `src-tauri/Cargo.toml` — add `bytes` crate

---

## P3 - Port Space Expansion + Collision Detection

**Status**: [x] DONE

**Problem**: 800-port hash space (32200..=32999) has ~50% collision probability at 34 devices (birthday problem).

**Solution**: Expand range to 32200..=39999 (7800 ports) or add collision detection with fallback.

**Benefit**: Support 100+ devices without port collisions.

**Files**:
- `src-tauri/src/adb/scrcpy_client.rs` — `scrcpy_local_port`

---

## Completed

_(Move items here after implementation)_
