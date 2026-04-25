use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::config::ServerConfig;
use super::device::{Device, parse_adb_devices, server_args};
use super::run_adb_command_with_timeout;

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

fn fetch_device_info(serial: &str, srv: &AdbServer) -> Device {
    let mut screen_width: u32 = 0;
    let mut screen_height: u32 = 0;
    let mut model = String::new();
    let mut battery: i32 = -1;

    // Single adb shell call combining all 3 queries, separated by a sentinel.
    // This reduces 3 sequential process spawns + round-trips to 1.
    {
        let mut args = server_args(&srv.host, srv.port);

        args.extend(["-s".into(), serial.into(), "shell".into(), "wm".into(), "size".into()]);
        let output = run_adb_command_with_timeout(&args, 5);
        // Parse "Physical size: 1080x2400" or "Override size: ..."
        for line in output.lines().rev() {
            if line.contains("size:") {
                if let Some(dims) = line.split(':').last() {
                    let parts: Vec<&str> = dims.trim().split('x').collect();
                    if parts.len() == 2 {
                        screen_width = parts[0].trim().parse().unwrap_or(0);
                        screen_height = parts[1].trim().parse().unwrap_or(0);
                        break;
        args.extend([
            "-s".into(), serial.into(), "shell".into(),
            "wm size; echo '---DELIM---'; getprop ro.product.model; echo '---DELIM---'; dumpsys battery".into(),
        ]);
        let output = run_adb_timeout(&args, 10);
        let sections: Vec<&str> = output.split("---DELIM---").collect();

        // Section 0: wm size
        if let Some(wm_output) = sections.first() {
            for line in wm_output.lines().rev() {
                if line.contains("size:") {
                    if let Some(dims) = line.split(':').last() {
                        let parts: Vec<&str> = dims.trim().split('x').collect();
                        if parts.len() == 2 {
                            screen_width = parts[0].trim().parse().unwrap_or(0);
                            screen_height = parts[1].trim().parse().unwrap_or(0);
                            break;
                        }
                    }
                }
            }
        }


    // Get model name
    {
        let mut args = server_args(&srv.host, srv.port);
        args.extend(["-s".into(), serial.into(), "shell".into(),
            "getprop".into(), "ro.product.model".into()]);
        let output = run_adb_command_with_timeout(&args, 5);
        model = output.trim().to_string();
    }

    // Get battery level
    {
        let mut args = server_args(&srv.host, srv.port);
        args.extend(["-s".into(), serial.into(), "shell".into(),
            "dumpsys".into(), "battery".into()]);
        let output = run_adb_command_with_timeout(&args, 5);
        for line in output.lines() {
            let line = line.trim();
            if line.starts_with("level:") {
                battery = line.split(':').last()
                    .and_then(|v| v.trim().parse().ok())
                    .unwrap_or(-1);
                break;
        // Section 1: getprop ro.product.model
        if let Some(model_output) = sections.get(1) {
            model = model_output.trim().to_string();
        }

        // Section 2: dumpsys battery
        if let Some(battery_output) = sections.get(2) {
            for line in battery_output.lines() {
                let line = line.trim();
                if line.starts_with("level:") {
                    battery = line.split(':').last()
                        .and_then(|v| v.trim().parse().ok())
                        .unwrap_or(-1);
                    break;
                }
            }
        }
    }

    println!("[DEVICE] serial={} model={} battery={} screen={}x{}",
        serial, model, battery, screen_width, screen_height);

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
    use super::run_adb_command;

    let servers = servers.lock().await.clone();
    let mut tasks = Vec::new();

    for srv in servers.iter().filter(|s| s.enabled) {
        let srv = srv.clone();
        let task = tokio::spawn(async move {
            let mut args = server_args(&srv.host, srv.port);
            args.push("devices".into());
            // 30 秒超时获取设备列表，连不上的 server 快速失败
            let output = tokio::task::spawn_blocking(move || {
                run_adb_command(&args)
            }).await;

            let output = match output {
                Ok(o) => String::from_utf8_lossy(&o.stdout).to_string(),
                Err(_) => String::new(),
            };
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
