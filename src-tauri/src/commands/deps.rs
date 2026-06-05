use std::process::Command;
use std::fs;
use tauri::{AppHandle, Emitter};
use crate::models::{DependencyStatus, InstallProgress};
use crate::utils::{run_shell_cmd, refresh_path_env};

#[tauri::command]
pub fn check_dependencies() -> DependencyStatus {
    refresh_path_env();

    let node_version = run_shell_cmd("node", &["--version"])
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "Not Installed".to_string());

    let rust_version = run_shell_cmd("rustc", &["--version"])
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "Not Installed".to_string());

    let node_installed = node_version != "Not Installed" && !node_version.is_empty();
    let rust_installed = rust_version != "Not Installed" && !rust_version.is_empty();

    // Check if pake-cli works via npx
    let pake_installed = run_shell_cmd("npx", &["pake-cli", "--version"])
        .map(|o| o.status.success())
        .unwrap_or(false);

    DependencyStatus {
        node_installed,
        rust_installed,
        pake_installed,
        node_version,
        rust_version,
    }
}

#[tauri::command]
pub fn install_dependencies(app_handle: AppHandle) -> Result<(), String> {
    let app_handle_clone = app_handle.clone();

    std::thread::spawn(move || {
        macro_rules! emit {
            ($msg:expr, $status:expr) => {{
                let _ = app_handle_clone.emit(
                    "install-progress",
                    InstallProgress {
                        message: $msg.to_string(),
                        status: $status.to_string(),
                    },
                );
            }};
        }

        let tmp_dir = std::env::temp_dir();

        // ── Node.js ────────────────────────────────────────────────────────────
        let node_already = run_shell_cmd("node", &["--version"])
            .map(|o| o.status.success())
            .unwrap_or(false);

        if node_already {
            emit!("Node.js already installed — skipping.", "running");
        } else {
            emit!("Downloading Node.js LTS installer…", "running");

            let node_msi = tmp_dir.join("node_installer.msi");
            let node_msi_str = node_msi.to_string_lossy().to_string();

            // Latest LTS redirect — always resolves to current LTS MSI
            let node_url = "https://nodejs.org/dist/latest-v22.x/node-v22.15.1-x64.msi";

            let dl_status = Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-ExecutionPolicy", "Bypass",
                    "-Command",
                    &format!(
                        "Invoke-WebRequest -Uri '{}' -OutFile '{}' -UseBasicParsing",
                        node_url, node_msi_str
                    ),
                ])
                .status();

            match dl_status {
                Ok(s) if s.success() => {
                    emit!("Installing Node.js silently…", "running");
                    let install_status = Command::new("msiexec")
                        .args(["/i", &node_msi_str, "/qn", "/norestart",
                               "ADDLOCAL=ALL"])
                        .status();
                    match install_status {
                        Ok(s) if s.success() => emit!("Node.js installed successfully.", "running"),
                        Ok(s) => emit!(
                            format!("Node.js installer exited with code {:?}.", s.code()),
                            "running"
                        ),
                        Err(e) => emit!(format!("Failed to run Node.js installer: {}", e), "error"),
                    }
                    let _ = fs::remove_file(&node_msi);
                }
                Ok(_) | Err(_) => emit!("Failed to download Node.js.", "error"),
            }
        }

        // ── Rust / Rustup ──────────────────────────────────────────────────────
        let rust_already = run_shell_cmd("rustc", &["--version"])
            .map(|o| o.status.success())
            .unwrap_or(false);

        if rust_already {
            emit!("Rust already installed — skipping.", "running");
        } else {
            emit!("Downloading Rustup installer…", "running");

            let rustup_exe = tmp_dir.join("rustup-init.exe");
            let rustup_exe_str = rustup_exe.to_string_lossy().to_string();

            let dl_status = Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-ExecutionPolicy", "Bypass",
                    "-Command",
                    &format!(
                        "Invoke-WebRequest -Uri 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe' -OutFile '{}' -UseBasicParsing",
                        rustup_exe_str
                    ),
                ])
                .status();

            match dl_status {
                Ok(s) if s.success() => {
                    emit!("Installing Rust toolchain silently (this takes a few minutes)…", "running");
                    // -y = no prompts, --default-toolchain stable
                    let install_status = Command::new(&rustup_exe)
                        .args(["-y", "--default-toolchain", "stable",
                               "--default-host", "x86_64-pc-windows-msvc"])
                        .status();
                    match install_status {
                        Ok(s) if s.success() => emit!("Rust installed successfully.", "running"),
                        Ok(s) => emit!(
                            format!("Rustup installer exited with code {:?}.", s.code()),
                            "running"
                        ),
                        Err(e) => emit!(format!("Failed to run Rustup installer: {}", e), "error"),
                    }
                    let _ = fs::remove_file(&rustup_exe);
                }
                Ok(_) | Err(_) => emit!("Failed to download Rustup.", "error"),
            }
        }

        emit!(
            "Setup complete! Please restart wapp and click 'Refresh' to verify.",
            "done"
        );
    });

    Ok(())
}
