use std::process::Command;

/// 为 Windows 创建进程时添加 CREATE_NO_WINDOW 标志
/// 在 Windows 上运行 adb 命令时不弹出终端窗口
#[cfg(target_os = "windows")]
fn creation_flags() -> u32 {
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    CREATE_NO_WINDOW
}

#[cfg(not(target_os = "windows"))]
fn creation_flags() -> u32 {
    0
}

/// 执行 adb 命令并返回输出（同步版本）
pub fn run_adb_command(args: &[String]) -> std::process::Output {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        Command::new("adb")
            .args(args)
            .creation_flags(creation_flags())
            .output()
            .unwrap_or_else(|_| std::process::Output {
                status: std::process::ExitStatus::default(),
                stdout: Vec::new(),
                stderr: Vec::new(),
            })
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new("adb")
            .args(args)
            .output()
            .unwrap_or_else(|_| std::process::Output {
                status: std::process::ExitStatus::default(),
                stdout: Vec::new(),
                stderr: Vec::new(),
            })
    }
}

/// 执行 adb 命令并返回输出（带超时）
pub fn run_adb_command_with_timeout(args: &[String], timeout_secs: u64) -> String {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut child = match Command::new("adb")
            .args(args)
            .creation_flags(creation_flags())
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

    #[cfg(not(target_os = "windows"))]
    {
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
}

/// spawn adb 进程并返回 Child
pub fn spawn_adb_command(args: &[String]) -> Option<std::process::Child> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        Command::new("adb")
            .args(args)
            .creation_flags(creation_flags())
            .spawn()
            .ok()
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new("adb")
            .args(args)
            .spawn()
            .ok()
    }
}
