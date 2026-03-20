use serde::{Deserialize, Serialize};
use std::process::Command;

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
    let out = Command::new("adb")
        .args(&args)
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).to_string())
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
