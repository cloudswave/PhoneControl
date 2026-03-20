use serde::{Deserialize, Serialize};
use std::process::Command;
use tokio::sync::Mutex;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::config::ServerConfig;
use super::device::{Device, parse_adb_devices, server_args};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdbServer {
    pub id: String,
    pub host: String,
    pub port: u16,
    pub enabled: bool,
}

impl AdbServer {
    pub fn new(host: String, port: u16) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            host,
            port,
            enabled: true,
        }
    }

    pub fn from_config(cfg: &ServerConfig) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            host: cfg.host.clone(),
            port: cfg.port,
            enabled: cfg.enabled,
        }
    }
}

fn run_adb(args: &[String]) -> String {
    Command::new("adb")
        .args(args)
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default()
}

fn fetch_device_info(serial: &str, srv: &AdbServer) -> Device {
    let prefix = server_args(&srv.host, srv.port);

    let model = {
        let mut args = prefix.clone();
        args.extend(["-s".into(), serial.into(), "shell".into(),
            "getprop".into(), "ro.product.model".into()]);
        run_adb(&args).trim().to_string()
    };

    let battery = {
        let mut args = prefix.clone();
        args.extend(["-s".into(), serial.into(), "shell".into(),
            "dumpsys".into(), "battery".into()]);
        let out = run_adb(&args);
        out.lines()
            .find(|l| l.contains("level:"))
            .and_then(|l| l.split(':').nth(1))
            .and_then(|v| v.trim().parse().ok())
            .unwrap_or(-1)
    };

    let (screen_width, screen_height) = {
        let mut args = prefix.clone();
        args.extend(["-s".into(), serial.into(), "shell".into(),
            "wm".into(), "size".into()]);
        let out = run_adb(&args);
        // "Physical size: 1080x1920"
        out.lines()
            .find(|l| l.contains("Physical size:") || l.contains("Override size:"))
            .and_then(|l| l.split(':').nth(1))
            .and_then(|s| {
                let parts: Vec<&str> = s.trim().split('x').collect();
                if parts.len() == 2 {
                    let w = parts[0].trim().parse().ok()?;
                    let h = parts[1].trim().parse().ok()?;
                    Some((w, h))
                } else {
                    None
                }
            })
            .unwrap_or((0, 0))
    };

    Device {
        serial: serial.to_string(),
        status: "online".into(),
        model,
        battery,
        screen_width,
        screen_height,
        server_host: srv.host.clone(),
        server_port: srv.port,
    }
}

pub async fn poll_all_servers(
    servers: Arc<Mutex<Vec<AdbServer>>>,
    app: AppHandle,
) {
    let servers = servers.lock().await;
    let mut all_devices: Vec<Device> = Vec::new();

    for srv in servers.iter().filter(|s| s.enabled) {
        let mut args = server_args(&srv.host, srv.port);
        args.push("devices".into());
        let output = run_adb(&args);
        let pairs = parse_adb_devices(&output);

        for (serial, status) in pairs {
            if status == "device" {
                let dev = fetch_device_info(&serial, srv);
                all_devices.push(dev);
            } else {
                all_devices.push(Device {
                    serial,
                    status,
                    model: String::new(),
                    battery: -1,
                    screen_width: 0,
                    screen_height: 0,
                    server_host: srv.host.clone(),
                    server_port: srv.port,
                });
            }
        }
    }

    let _ = app.emit("devices-updated", &all_devices);
}
