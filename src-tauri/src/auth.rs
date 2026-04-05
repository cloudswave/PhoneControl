use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use base64::{Engine as _, engine::general_purpose};
use tauri::command;
use mac_address::get_mac_address;
use reqwest;

const SALT_KEY: &str = "phone-control-salt-key-2024";

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorizationConfig {
    pub machine_code: String,
    pub license_key: String,
    pub signature: String,
    pub timestamp: u64,
}

#[derive(Serialize, Deserialize)]
pub struct AuthorizationRequest {
    machine_code: String,
    license_key: String,
}

#[derive(Serialize, Deserialize)]
pub struct AuthorizationResponse {
    status: String,
    message: Option<String>,
}

fn config_path() -> PathBuf {
    let mut p = dirs_next::home_dir().unwrap_or_else(|| PathBuf::from("."));
    p.push(".phone_control");
    fs::create_dir_all(&p).ok();
    p.push("auth.json");
    p
}

pub fn load_authorization() -> Option<AuthorizationConfig> {
    let path = config_path();
    if !path.exists() {
        return None;
    }
    let text = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&text).ok()
}

pub fn save_authorization(auth: &AuthorizationConfig) -> Result<(), String> {
    let path = config_path();
    let text = serde_json::to_string_pretty(auth).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| e.to_string())
}

pub fn generate_signature(machine_code: &str, license_key: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(SALT_KEY.as_bytes()).expect("HMAC can take key of any size");
    mac.update(machine_code.as_bytes());
    mac.update(license_key.as_bytes());
    let result = mac.finalize();
    general_purpose::STANDARD.encode(result.into_bytes())
}

pub fn verify_signature(machine_code: &str, license_key: &str, signature: &str) -> bool {
    let expected = generate_signature(machine_code, license_key);
    expected == signature
}

#[command]
pub async fn verify_authorization(
    license_key: String,
) -> Result<AuthorizationResponse, String> {
    // 获取 MAC 地址
    let machine_code = match get_mac_address() {
        Ok(Some(addr)) => format!("pc_{}", addr),
        _ => return Err("获取 MAC 地址失败".to_string()),
    };

    let client = reqwest::Client::new();

    let request_body = AuthorizationRequest {
        machine_code: machine_code.clone(),
        license_key: license_key.trim().to_string(),
    };

    let response = client
        .post("http://zjw.ethan.cloud-ip.biz/license/api.php")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    let auth_response: AuthorizationResponse = response
        .json()
        .await
        .map_err(|e| format!("无法解析响应: {}", e))?;

    if auth_response.status == "success" {
        // 生成签名并保存
        let signature = generate_signature(&machine_code, &license_key.trim());
        let auth_config = AuthorizationConfig {
            machine_code,
            license_key: license_key.trim().to_string(),
            signature,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };
        save_authorization(&auth_config)?;
        Ok(auth_response)
    } else {
        Err(auth_response.message.unwrap_or_else(|| "授权失败".to_string()))
    }
}

#[command]
pub async fn check_authorization_status() -> Result<bool, String> {
    if let Some(auth) = load_authorization() {
        // 获取当前机器码
        let current_machine_code = match get_mac_address() {
            Ok(Some(addr)) => format!("pc_{}", addr),
            _ => return Ok(false), // 无法获取机器码，视为未授权
        };

        // 检查机器码是否匹配
        if auth.machine_code != current_machine_code {
            return Ok(false); // 机器码不匹配，视为未授权
        }

        // 校验签名
        if verify_signature(&auth.machine_code, &auth.license_key, &auth.signature) {
            Ok(true)
        } else {
            // 签名无效，清除
            Ok(false)
        }
    } else {
        Ok(false)
    }
}