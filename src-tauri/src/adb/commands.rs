use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::Duration;
use wait_timeout::ChildExt;

use super::device::server_args;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub serial: String,
    pub success: bool,
    pub message: String,
}

fn scale(value: f64, source_dim: u32, target_dim: u32) -> i32 {
    if source_dim == 0 || target_dim == 0 {
        return value as i32;
    }
    ((value / source_dim as f64) * target_dim as f64).round() as i32
}

fn run_adb_device(host: &str, port: u16, serial: &str, shell_args: &[&str]) -> Result<(), String> {
    let mut args = server_args(host, port);
    args.extend(["-s".into(), serial.into(), "shell".into()]);
    args.extend(shell_args.iter().map(|s| s.to_string()));

    let start = std::time::Instant::now();
    let mut child = Command::new("adb")
        .args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn adb: {}", e))?;

    match child
        .wait_timeout(Duration::from_secs(3))
        .map_err(|e| format!("Timeout handling error: {}", e))?
    {
        Some(status) => {
            let stdout = child.stdout.take().map(|mut s| {
                let mut buf = String::new();
                std::io::Read::read_to_string(&mut s, &mut buf).ok();
                buf
            }).unwrap_or_default();
            let stderr = child.stderr.take().map(|mut s| {
                let mut buf = String::new();
                std::io::Read::read_to_string(&mut s, &mut buf).ok();
                buf
            }).unwrap_or_default();
            if !stdout.trim().is_empty() || !stderr.trim().is_empty() {
                println!("[ADB] serial={} status={} out={:?} err={:?} ({:.0}ms)",
                    serial, status, stdout.trim(), stderr.trim(), start.elapsed().as_millis());
            }
            if status.success() {
                Ok(())
            } else {
                Err(format!("ADB command failed: status={} err={} ({:.0}ms)", status, stderr.trim(), start.elapsed().as_millis()))
            }
        }
        None => {
            let _ = child.kill();
            let _ = child.wait();
            Err(format!("ADB command timeout (>3s, {:.0}ms) - process killed", start.elapsed().as_millis()))
        }
    }
}

pub fn tap(
    host: &str, port: u16, serial: &str,
    x: f64, y: f64,
    source_w: u32, source_h: u32,
    target_w: u32, target_h: u32,
) -> CommandResult {
    let tx = scale(x, source_w, target_w);
    let ty = scale(y, source_h, target_h);
    let xs = tx.to_string();
    let ys = ty.to_string();
    let result = run_adb_device(host, port, serial, &["input", "tap", &xs, &ys]);
    CommandResult {
        serial: serial.to_string(),
        success: result.is_ok(),
        message: result.err().unwrap_or_default(),
    }
}

pub fn swipe(
    host: &str, port: u16, serial: &str,
    x1: f64, y1: f64, x2: f64, y2: f64,
    duration_ms: u32,
    source_w: u32, source_h: u32,
    target_w: u32, target_h: u32,
) -> CommandResult {
    let tx1 = scale(x1, source_w, target_w).to_string();
    let ty1 = scale(y1, source_h, target_h).to_string();
    let tx2 = scale(x2, source_w, target_w).to_string();
    let ty2 = scale(y2, source_h, target_h).to_string();
    let dur = duration_ms.to_string();
    let result = run_adb_device(host, port, serial, &["input", "swipe", &tx1, &ty1, &tx2, &ty2, &dur]);
    CommandResult {
        serial: serial.to_string(),
        success: result.is_ok(),
        message: result.err().unwrap_or_default(),
    }
}

pub fn send_text(host: &str, port: u16, serial: &str, text: &str) -> CommandResult {
    // Escape spaces for adb input text
    let escaped = text.replace(' ', "%s");
    let result = run_adb_device(host, port, serial, &["input", "text", &escaped]);
    CommandResult {
        serial: serial.to_string(),
        success: result.is_ok(),
        message: result.err().unwrap_or_default(),
    }
}

pub fn keyevent(host: &str, port: u16, serial: &str, keycode: u32) -> CommandResult {
    let kc = keycode.to_string();
    let result = run_adb_device(host, port, serial, &["input", "keyevent", &kc]);
    CommandResult {
        serial: serial.to_string(),
        success: result.is_ok(),
        message: result.err().unwrap_or_default(),
    }
}

pub fn wake_up_device(host: &str, port: u16, serial: &str) -> CommandResult {
    let mut check_args = server_args(host, port);
    check_args.extend(["-s".into(), serial.into(), "shell".into(), "dumpsys".into(), "power".into()]);

    let mut child = match Command::new("adb").args(&check_args).spawn() {
        Ok(child) => child,
        Err(e) => {
            return CommandResult {
                serial: serial.to_string(),
                success: false,
                message: e.to_string(),
            }
        }
    };

    match child.wait_timeout(Duration::from_secs(3)) {
        Ok(Some(status)) => {
            if !status.success() {
                return CommandResult {
                    serial: serial.to_string(),
                    success: false,
                    message: format!("Failed to check device state: {}", status),
                };
            }

            let out = match Command::new("adb").args(&check_args).output() {
                Ok(out) => out,
                Err(e) => {
                    return CommandResult {
                        serial: serial.to_string(),
                        success: false,
                        message: e.to_string(),
                    }
                }
            };
            let output = String::from_utf8_lossy(&out.stdout);

            if output.contains("mWakefulness=Asleep") {
                let result = run_adb_device(host, port, serial, &["input", "keyevent", "26"]);
                CommandResult {
                    serial: serial.to_string(),
                    success: result.is_ok(),
                    message: if result.is_ok() {
                        "Device woken up".to_string()
                    } else {
                        result.err().unwrap_or_default()
                    },
                }
            } else {
                CommandResult {
                    serial: serial.to_string(),
                    success: true,
                    message: "Device already awake".to_string(),
                }
            }
        }
        Ok(None) => {
            let _ = child.kill();
            let _ = child.wait();
            CommandResult {
                serial: serial.to_string(),
                success: false,
                message: "Timeout checking device state (>3s) - process killed".to_string(),
            }
        }
        Err(e) => CommandResult {
            serial: serial.to_string(),
            success: false,
            message: e.to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scale_same_resolution() {
        assert_eq!(scale(100.0, 1080, 1080), 100);
        assert_eq!(scale(540.0, 1080, 1080), 540);
    }

    #[test]
    fn test_scale_half_resolution() {
        // source 200px wide card, target 1080 device
        assert_eq!(scale(100.0, 200, 1080), 540);
        assert_eq!(scale(50.0, 200, 1080), 270);
    }

    #[test]
    fn test_scale_zero_source() {
        // zero source_dim → return value as-is
        assert_eq!(scale(123.0, 0, 1080), 123);
    }

    #[test]
    fn test_scale_rounding() {
        // 1/3 of 1080 = 360
        assert_eq!(scale(1.0, 3, 1080), 360);
    }
}
