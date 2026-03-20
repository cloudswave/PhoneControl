mod config;
mod state;
pub mod adb;

use state::AppState;
use adb::server::{AdbServer, poll_all_servers};
use adb::commands::{tap, swipe, send_text, keyevent, CommandResult};
use adb::screenshot::{start_screenshot_loop, stop_screenshot_loop};
use config::{load_servers, save_servers, ServerConfig};

use std::sync::Arc;
use tauri::{AppHandle, Emitter, State, Manager};

// ── Server management ────────────────────────────────────────────────────────

#[tauri::command]
async fn add_server(
    host: String,
    port: u16,
    state: State<'_, AppState>,
) -> Result<AdbServer, String> {
    let mut servers = state.servers.lock().await;
    if servers.iter().any(|s| s.host == host && s.port == port) {
        return Err("Server already exists".into());
    }
    let srv = AdbServer::new(host, port);
    servers.push(srv.clone());
    let cfgs: Vec<ServerConfig> = servers.iter().map(|s| ServerConfig {
        host: s.host.clone(), port: s.port, enabled: s.enabled,
    }).collect();
    drop(servers);
    save_servers(&cfgs)?;
    Ok(srv)
}

#[tauri::command]
async fn remove_server(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut servers = state.servers.lock().await;
    servers.retain(|s| s.id != id);
    let cfgs: Vec<ServerConfig> = servers.iter().map(|s| ServerConfig {
        host: s.host.clone(), port: s.port, enabled: s.enabled,
    }).collect();
    drop(servers);
    save_servers(&cfgs)
}

#[tauri::command]
async fn toggle_server(id: String, enabled: bool, state: State<'_, AppState>) -> Result<(), String> {
    let mut servers = state.servers.lock().await;
    if let Some(s) = servers.iter_mut().find(|s| s.id == id) {
        s.enabled = enabled;
    }
    let cfgs: Vec<ServerConfig> = servers.iter().map(|s| ServerConfig {
        host: s.host.clone(), port: s.port, enabled: s.enabled,
    }).collect();
    drop(servers);
    save_servers(&cfgs)
}

#[tauri::command]
async fn get_servers(state: State<'_, AppState>) -> Result<Vec<AdbServer>, String> {
    Ok(state.servers.lock().await.clone())
}

// ── Preview ──────────────────────────────────────────────────────────────────

#[tauri::command]
async fn start_preview(
    serial: String,
    fps: u32,
    server_host: String,
    server_port: u16,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let tokens = Arc::clone(&state.screenshot_tokens);
    tauri::async_runtime::spawn(start_screenshot_loop(tokens, serial, server_host, server_port, fps, app));
    Ok(())
}

#[tauri::command]
async fn stop_preview(serial: String, state: State<'_, AppState>) -> Result<(), String> {
    stop_screenshot_loop(Arc::clone(&state.screenshot_tokens), &serial).await;
    Ok(())
}

#[tauri::command]
async fn set_fps(serial: String, fps: u32, server_host: String, server_port: u16, state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    stop_screenshot_loop(Arc::clone(&state.screenshot_tokens), &serial).await;
    let tokens = Arc::clone(&state.screenshot_tokens);
    tauri::async_runtime::spawn(start_screenshot_loop(tokens, serial, server_host, server_port, fps, app));
    Ok(())
}

// ── Group control ────────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
pub struct DeviceResolution {
    pub serial: String,
    pub width: u32,
    pub height: u32,
    pub server_host: String,
    pub server_port: u16,
}

#[tauri::command]
async fn tap_devices(
    serials: Vec<DeviceResolution>,
    x: f64,
    y: f64,
    source_width: u32,
    source_height: u32,
) -> Result<Vec<CommandResult>, String> {
    let results = serials.iter().map(|d| {
        tap(&d.server_host, d.server_port, &d.serial, x, y, source_width, source_height, d.width, d.height)
    }).collect();
    Ok(results)
}

#[tauri::command]
async fn swipe_devices(
    serials: Vec<DeviceResolution>,
    x1: f64, y1: f64, x2: f64, y2: f64,
    duration_ms: u32,
    source_width: u32,
    source_height: u32,
) -> Result<Vec<CommandResult>, String> {
    let results = serials.iter().map(|d| {
        swipe(&d.server_host, d.server_port, &d.serial, x1, y1, x2, y2, duration_ms, source_width, source_height, d.width, d.height)
    }).collect();
    Ok(results)
}

#[tauri::command]
async fn send_text_devices(
    serials: Vec<DeviceResolution>,
    text: String,
) -> Result<Vec<CommandResult>, String> {
    let results = serials.iter().map(|d| {
        send_text(&d.server_host, d.server_port, &d.serial, &text)
    }).collect();
    Ok(results)
}

#[tauri::command]
async fn keyevent_devices(
    serials: Vec<DeviceResolution>,
    keycode: u32,
) -> Result<Vec<CommandResult>, String> {
    let results = serials.iter().map(|d| {
        keyevent(&d.server_host, d.server_port, &d.serial, keycode)
    }).collect();
    Ok(results)
}

// ── scrcpy ───────────────────────────────────────────────────────────────────

#[tauri::command]
async fn launch_scrcpy(serial: String, server_host: String, server_port: u16) -> Result<(), String> {
    let is_remote = !(server_host == "127.0.0.1" || server_host == "localhost");
    tauri::async_runtime::spawn(async move {
        let mut cmd = tokio::process::Command::new("scrcpy");
        cmd.args(["-s", &serial]);
        if is_remote {
            cmd.env("ADB_SERVER_SOCKET", format!("tcp:{}:{}", server_host, server_port));
            cmd.args(["--tunnel-host", &server_host]);
        }
        let _ = cmd.status().await;
    });
    Ok(())
}

// ── Shell command ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn run_shell_devices(
    serials: Vec<DeviceResolution>,
    cmd: String,
) -> Result<Vec<CommandResult>, String> {
    use adb::device::server_args;
    let results: Vec<CommandResult> = serials.iter().map(|d| {
        let mut args = server_args(&d.server_host, d.server_port);
        args.extend(["-s".into(), d.serial.clone(), "shell".into()]);
        args.extend(cmd.split_whitespace().map(String::from));
        let out = std::process::Command::new("adb")
            .args(&args)
            .output();
        match out {
            Ok(o) => CommandResult {
                serial: d.serial.clone(),
                success: o.status.success(),
                message: String::from_utf8_lossy(&o.stdout).to_string()
                    + &String::from_utf8_lossy(&o.stderr),
            },
            Err(e) => CommandResult {
                serial: d.serial.clone(),
                success: false,
                message: e.to_string(),
            },
        }
    }).collect();
    Ok(results)
}

// ── Config ───────────────────────────────────────────────────────────────────

#[tauri::command]
async fn load_config(state: State<'_, AppState>) -> Result<Vec<AdbServer>, String> {
    Ok(state.servers.lock().await.clone())
}

// ── App entry ────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Ensure adb/scrcpy are findable in bundled macOS app
    if let Ok(path) = std::env::var("PATH") {
        let extra = [
            "/usr/local/bin",
            "/opt/homebrew/bin",
            "/Library/android/SDK/platform-tools",
            &format!("{}/Library/Android/sdk/platform-tools", std::env::var("HOME").unwrap_or_default()),
        ];
        let new_path = format!("{}:{}", extra.join(":"), path);
        std::env::set_var("PATH", new_path);
    }

    let servers_cfg = load_servers();
    let servers: Vec<AdbServer> = servers_cfg.iter().map(AdbServer::from_config).collect();
    let app_state = AppState::new(servers);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            add_server,
            remove_server,
            toggle_server,
            get_servers,
            start_preview,
            stop_preview,
            set_fps,
            tap_devices,
            swipe_devices,
            send_text_devices,
            keyevent_devices,
            launch_scrcpy,
            run_shell_devices,
            load_config,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            let state = app.state::<AppState>();
            let servers = Arc::clone(&state.servers);
            tauri::async_runtime::spawn(async move {
                loop {
                    poll_all_servers(Arc::clone(&servers), app_handle.clone()).await;
                    tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
