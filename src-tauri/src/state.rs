use std::sync::Arc;
use tokio::sync::Mutex;

use crate::adb::server::AdbServer;
use crate::adb::screenshot::ScreenshotTokens;

pub struct AppState {
    pub servers: Arc<Mutex<Vec<AdbServer>>>,
    pub screenshot_tokens: ScreenshotTokens,
}

impl AppState {
    pub fn new(servers: Vec<AdbServer>) -> Self {
        Self {
            servers: Arc::new(Mutex::new(servers)),
            screenshot_tokens: crate::adb::screenshot::new_tokens(),
        }
    }
}
