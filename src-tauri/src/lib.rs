use std::process::{Command, Stdio};
use std::path::{Path, PathBuf};
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use tauri::{AppHandle, Manager, Emitter};

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
struct WappConfig {
    id: String,
    name: String,
    url: String,
    icon: Option<String>,
    width: u32,
    height: u32,
    hide_title_bar: bool,
    category: String,
    created_at: String,
    path: String,
}

#[derive(serde::Serialize, Debug)]
struct DependencyStatus {
    node_installed: bool,
    rust_installed: bool,
    pake_installed: bool,
    node_version: String,
    rust_version: String,
}

#[derive(Clone, serde::Serialize, Debug)]
struct BuildProgress {
    app_id: String,
    message: String,
    status: String, // "running", "success", "error"
}

fn run_shell_cmd(cmd: &str, args: &[&str]) -> std::io::Result<std::process::Output> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .arg("/C")
            .arg(format!("{} {}", cmd, args.join(" ")))
            .output()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new(cmd)
            .args(args)
            .output()
    }
}

fn refresh_path_env() {
    #[cfg(target_os = "windows")]
    {
        let mut updated = false;
        let mut current_paths = std::env::var("PATH").unwrap_or_default();
        
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            let cargo_bin = format!("{}\\.cargo\\bin", user_profile);
            let cargo_path = Path::new(&cargo_bin);
            if cargo_path.exists() && !current_paths.contains(&cargo_bin) {
                current_paths = format!("{};{}", cargo_bin, current_paths);
                updated = true;
            }
        }
        
        if let Ok(program_files) = std::env::var("ProgramFiles") {
            let node_bin = format!("{}\\nodejs", program_files);
            let node_path = Path::new(&node_bin);
            if node_path.exists() && !current_paths.contains(&node_bin) {
                current_paths = format!("{};{}", node_bin, current_paths);
                updated = true;
            }
        }
        
        if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
            let node_bin = format!("{}\\nodejs", program_files_x86);
            let node_path = Path::new(&node_bin);
            if node_path.exists() && !current_paths.contains(&node_bin) {
                current_paths = format!("{};{}", node_bin, current_paths);
                updated = true;
            }
        }

        if updated {
            std::env::set_var("PATH", current_paths);
        }
    }
}

#[tauri::command]
fn check_dependencies() -> DependencyStatus {
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

fn get_workspace_dir(app_handle: &AppHandle) -> PathBuf {
    let data_dir = app_handle.path().app_data_dir().unwrap_or_else(|_| {
        PathBuf::from(".")
    });
    let workspace = data_dir.join("wapps_workspace");
    if !workspace.exists() {
        let _ = fs::create_dir_all(&workspace);
    }
    workspace
}

fn get_config_file_path(app_handle: &AppHandle) -> PathBuf {
    get_workspace_dir(app_handle).join("wapps.json")
}

#[tauri::command]
fn load_wapps(app_handle: AppHandle) -> Vec<WappConfig> {
    let config_path = get_config_file_path(&app_handle);
    if !config_path.exists() {
        return Vec::new();
    }
    let file = match File::open(config_path) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };
    serde_json::from_reader(file).unwrap_or_else(|_| Vec::new())
}

#[tauri::command]
fn save_wapps(app_handle: AppHandle, wapps: Vec<WappConfig>) -> Result<(), String> {
    let config_path = get_config_file_path(&app_handle);
    let file = File::create(config_path).map_err(|e| e.to_string())?;
    serde_json::to_writer_pretty(file, &wapps).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn build_wapp(
    app_handle: AppHandle,
    id: String,
    name: String,
    url: String,
    icon: Option<String>,
    width: u32,
    height: u32,
    hide_title_bar: bool,
    category: String,
    created_at: String,
    maximize: bool,
) -> Result<(), String> {
    let app_handle_clone = app_handle.clone();
    let id_clone = id.clone();
    let name_clone = name.clone();
    let url_clone = url.clone();
    let category_clone = category.clone();

    std::thread::spawn(move || {
        let workspace_dir = get_workspace_dir(&app_handle_clone);
        let id_str = id_clone.clone();

        let _ = app_handle_clone.emit(
            "build-progress",
            BuildProgress {
                app_id: id_str.clone(),
                message: format!("Starting packaging for {}...", name_clone),
                status: "running".to_string(),
            },
        );

        let mut args = vec![
            "pake-cli".to_string(),
            url_clone.clone(),
            "--name".to_string(),
            name_clone.clone(),
            "--width".to_string(),
            width.to_string(),
            "--height".to_string(),
            height.to_string(),
        ];

        if hide_title_bar {
            args.push("--hide-title-bar".to_string());
        }

        if maximize {
            args.push("--maximize".to_string());
        }

        if let Some(ref icon_path) = icon {
            if !icon_path.trim().is_empty() {
                args.push("--icon".to_string());
                args.push(icon_path.clone());
            }
        }

        let target_dir = workspace_dir.join(".cargo_target");

        #[cfg(target_os = "windows")]
        let mut cmd = Command::new("cmd");
        #[cfg(target_os = "windows")]
        cmd.arg("/C").arg(format!("npx {}", args.join(" ")));

        #[cfg(not(target_os = "windows"))]
        let mut cmd = Command::new("npx");
        #[cfg(not(target_os = "windows"))]
        cmd.args(&args);

        cmd.current_dir(&workspace_dir)
            .env("CARGO_TARGET_DIR", &target_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let _ = app_handle_clone.emit(
                    "build-progress",
                    BuildProgress {
                        app_id: id_str.clone(),
                        message: format!("Failed to start build: {}", e),
                        status: "error".to_string(),
                    },
                );
                return;
            }
        };

        let stdout = child.stdout.take().unwrap();
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line_content) = line {
                let _ = app_handle_clone.emit(
                    "build-progress",
                    BuildProgress {
                        app_id: id_str.clone(),
                        message: line_content,
                        status: "running".to_string(),
                    },
                );
            }
        }

        let stderr = child.stderr.take().unwrap();
        let err_reader = BufReader::new(stderr);
        for line in err_reader.lines() {
            if let Ok(line_content) = line {
                let _ = app_handle_clone.emit(
                    "build-progress",
                    BuildProgress {
                        app_id: id_str.clone(),
                        message: line_content,
                        status: "running".to_string(),
                    },
                );
            }
        }

        let status = match child.wait() {
            Ok(s) => s,
            Err(e) => {
                let _ = app_handle_clone.emit(
                    "build-progress",
                    BuildProgress {
                        app_id: id_str.clone(),
                        message: format!("Failed waiting for build process: {}", e),
                        status: "error".to_string(),
                    },
                );
                return;
            }
        };

        if status.success() {
            let mut exe_filename = name_clone.clone();
            #[cfg(target_os = "windows")]
            {
                if !exe_filename.ends_with(".exe") {
                    exe_filename.push_str(".exe");
                }
            }
            #[cfg(target_os = "macos")]
            {
                if !exe_filename.ends_with(".app") {
                    exe_filename.push_str(".app");
                }
            }

            let mut final_path = workspace_dir.join(&exe_filename);
            if !final_path.exists() {
                let alt_name = name_clone.replace(" ", "_");
                let mut alt_filename = alt_name.clone();
                #[cfg(target_os = "windows")]
                alt_filename.push_str(".exe");
                #[cfg(target_os = "macos")]
                alt_filename.push_str(".app");

                let alt_path = workspace_dir.join(&alt_filename);
                if alt_path.exists() {
                    final_path = alt_path;
                } else {
                    if let Ok(entries) = fs::read_dir(&workspace_dir) {
                        for entry in entries.flatten() {
                            let path = entry.path();
                            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
                            #[cfg(target_os = "windows")]
                            let is_match = ext == "exe";
                            #[cfg(not(target_os = "windows"))]
                            let is_match = ext == "app" || ext == "dmg" || ext == "deb" || ext == "AppImage";
                            
                            if is_match {
                                final_path = path;
                                break;
                            }
                        }
                    }
                }
            }

            let mut current_wapps = load_wapps(app_handle_clone.clone());
            let path_str = final_path.to_string_lossy().to_string();

            if let Some(pos) = current_wapps.iter().position(|w| w.id == id_str) {
                current_wapps[pos] = WappConfig {
                    id: id_str.clone(),
                    name: name_clone.clone(),
                    url: url_clone.clone(),
                    icon: icon.clone(),
                    width,
                    height,
                    hide_title_bar,
                    category: category_clone.clone(),
                    created_at: created_at.clone(),
                    path: path_str,
                };
            } else {
                current_wapps.push(WappConfig {
                    id: id_str.clone(),
                    name: name_clone.clone(),
                    url: url_clone.clone(),
                    icon: icon.clone(),
                    width,
                    height,
                    hide_title_bar,
                    category: category_clone.clone(),
                    created_at: created_at.clone(),
                    path: path_str,
                });
            }

            let _ = save_wapps(app_handle_clone.clone(), current_wapps);

            let _ = app_handle_clone.emit(
                "build-progress",
                BuildProgress {
                    app_id: id_str.clone(),
                    message: format!("Successfully packaged {}!", name_clone),
                    status: "success".to_string(),
                },
            );
        } else {
            let _ = app_handle_clone.emit(
                "build-progress",
                BuildProgress {
                    app_id: id_str.clone(),
                    message: "Build failed. Check dependencies and URL.".to_string(),
                    status: "error".to_string(),
                },
            );
        }
    });

    Ok(())
}

#[tauri::command]
fn launch_wapp(path: String) -> Result<(), String> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err("App executable not found. Rebuild it.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .arg("/C")
            .arg("start")
            .arg("")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn open_workspace_folder(app_handle: AppHandle) -> Result<(), String> {
    let path = get_workspace_dir(&app_handle);
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Clone, serde::Serialize, Debug)]
struct InstallProgress {
    message: String,
    status: String, // "running" | "success" | "error" | "done"
}

#[tauri::command]
fn install_dependencies(app_handle: AppHandle) -> Result<(), String> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            check_dependencies,
            install_dependencies,
            load_wapps,
            save_wapps,
            build_wapp,
            launch_wapp,
            open_workspace_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
