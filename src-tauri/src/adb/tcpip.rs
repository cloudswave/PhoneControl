use serde::{Deserialize, Serialize};

use super::run_adb_command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TcpIpResult {
    pub serial: String,
    pub success: bool,
    pub message: String,
}

/// 获取所有USB连接的ADB设备
pub fn get_usb_devices() -> Vec<String> {
    let out = run_adb_command(&["devices".into(), "-l".into()]);

    let stdout = String::from_utf8_lossy(&out.stdout);
    stdout
        .lines()
        .skip(1) // skip "List of devices attached"
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let serial = parts[0].to_string();
                let status = parts[1].to_string();
                // 只返回USB设备（不包含ip:port格式的远程设备）
                if status == "device" && !serial.contains(':') {
                    Some(serial)
                } else {
                    None
                }
            } else {
                None
            }
        })
        .collect()
}

/// 对指定的serial执行adb tcpip 5555
pub fn enable_tcpip(serial: &str) -> TcpIpResult {
    let out = run_adb_command(&["-s".into(), serial.to_string(), "tcpip".into(), "5555".into()]);

    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);
    let output_str = if stdout.is_empty() { stderr.to_string() } else { stdout.to_string() };
    
    // 检查是否成功开启tcpip
    if output_str.contains("restarting") || output_str.contains("5555") {
        TcpIpResult {
            serial: serial.to_string(),
            success: true,
            message: output_str.trim().to_string(),
        }
    } else if output_str.contains("error") || output_str.contains("failed") || output_str.contains("cannot") {
        TcpIpResult {
            serial: serial.to_string(),
            success: false,
            message: output_str.trim().to_string(),
        }
    } else {
        // 其他情况视为成功（有些设备输出比较特殊）
        TcpIpResult {
            serial: serial.to_string(),
            success: true,
            message: output_str.trim().to_string(),
        }
    }
}

/// 遍历所有USB设备并执行adb tcpip 5555
pub fn enable_tcpip_all_usb() -> Vec<TcpIpResult> {
    let usb_devices = get_usb_devices();
    let mut results = Vec::new();
    
    for serial in usb_devices {
        let result = enable_tcpip(&serial);
        results.push(result);
    }
    
    results
}
