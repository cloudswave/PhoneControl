use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub ip: String,
    pub port: u16,
    pub success: bool,
    pub message: String,
}

/// 尝试连接到指定 IP:端口的 ADB 设备
pub fn try_connect(host: &str, port: u16) -> ScanResult {
    let address = format!("{}:{}", host, port);
    
    let output = Command::new("adb")
        .args(["connect", &address])
        .output();

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            let stderr = String::from_utf8_lossy(&o.stderr);
            let output_str = if stdout.is_empty() { stderr.to_string() } else { stdout.to_string() };
            
            // 检查是否连接成功
            if output_str.contains("connected") || output_str.contains("already connected") {
                ScanResult {
                    ip: host.to_string(),
                    port,
                    success: true,
                    message: output_str.trim().to_string(),
                }
            } else if output_str.contains("failed") || output_str.contains("cannot") || output_str.contains("refused") {
                ScanResult {
                    ip: host.to_string(),
                    port,
                    success: false,
                    message: output_str.trim().to_string(),
                }
            } else {
                // 其他情况视为失败
                ScanResult {
                    ip: host.to_string(),
                    port,
                    success: false,
                    message: output_str.trim().to_string(),
                }
            }
        }
        Err(e) => ScanResult {
            ip: host.to_string(),
            port,
            success: false,
            message: e.to_string(),
        },
    }
}

/// 扫描一个 IP 的端口范围
pub fn scan_ip_ports(host: &str, start_port: u16, end_port: u16) -> Vec<ScanResult> {
    let mut results = Vec::new();
    
    for port in start_port..=end_port {
        let result = try_connect(host, port);
        if result.success {
            results.push(result);
        }
    }
    
    results
}
