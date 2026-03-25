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

fn run_adb_timeout(args: &[String], timeout_secs: u64) -> String {
    let mut child = match Command::new("adb")
        .args(args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
    {
        Ok(c) => c,
        Err(_) => return String::new(),
    };

    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(timeout_secs);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => {
                if std::time::Instant::now() >= deadline {
                    let _ = child.kill();
                    return String::new();
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            Err(_) => return String::new(),
        }
    }

    child.wait_with_output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default()
}

fn fetch_device_info(serial: &str, srv: &AdbServer) -> Device {
    Device {
        serial: serial.to_string(),
        status: "online".into(),
        model: String::new(),
        battery: -1,
        screen_width: 0,
        screen_height: 0,
        server_host: srv.host.clone(),
        server_port: srv.port,
    }
}

pub async fn poll_all_servers(
    servers: Arc<Mutex<Vec<AdbServer>>>,
    app: AppHandle,
) {
    let servers = servers.lock().await.clone();
    let mut tasks = Vec::new();

    for srv in servers.iter().filter(|s| s.enabled) {
        let srv = srv.clone();
        let task = tokio::spawn(async move {
            let mut args = server_args(&srv.host, srv.port);
            args.push("devices".into());
            // 30 秒超时获取设备列表，连不上的 server 快速失败
            let output = tokio::task::spawn_blocking(move || run_adb_timeout(&args, 30))
                .await
                .unwrap_or_default();
            let pairs = parse_adb_devices(&output);

            let mut devices = Vec::new();
            let mut info_tasks = Vec::new();

            for (serial, status) in pairs {
                if status == "device" {
                    let serial = serial.clone();
                    let srv = srv.clone();
                    info_tasks.push(tokio::spawn(async move {
                        tokio::time::timeout(
                            std::time::Duration::from_secs(10),
                            tokio::task::spawn_blocking(move || fetch_device_info(&serial, &srv))
                        ).await.ok().and_then(|r| r.ok())
                    }));
                } else {
                    devices.push(Device {
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

            for task in info_tasks {
                if let Ok(Some(dev)) = task.await {
                    devices.push(dev);
                }
            }
            devices
        });
        tasks.push(task);
    }

    let mut all_devices = Vec::new();
    for task in tasks {
        if let Ok(devices) = task.await {
            all_devices.extend(devices);
        }
    }

    let _ = app.emit("devices-updated", &all_devices);
}
