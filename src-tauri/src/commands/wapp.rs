use std::process::{Command, Stdio};
use std::path::Path;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use tauri::{AppHandle, Emitter};
use crate::models::{WappConfig, BuildProgress};
use crate::utils::{get_workspace_dir, get_config_file_path};

#[tauri::command]
pub fn load_wapps(app_handle: AppHandle) -> Vec<WappConfig> {
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
pub fn save_wapps(app_handle: AppHandle, wapps: Vec<WappConfig>) -> Result<(), String> {
    let config_path = get_config_file_path(&app_handle);
    let file = File::create(config_path).map_err(|e| e.to_string())?;
    serde_json::to_writer_pretty(file, &wapps).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn build_wapp(
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
                    BuildProgress { app_id: id_str.clone(), message: line_content, status: "running".to_string() },
                );
            }
        }

        let stderr = child.stderr.take().unwrap();
        let err_reader = BufReader::new(stderr);
        for line in err_reader.lines() {
            if let Ok(line_content) = line {
                let _ = app_handle_clone.emit(
                    "build-progress",
                    BuildProgress { app_id: id_str.clone(), message: line_content, status: "running".to_string() },
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
            if !exe_filename.ends_with(".exe") { exe_filename.push_str(".exe"); }
            #[cfg(target_os = "macos")]
            if !exe_filename.ends_with(".app") { exe_filename.push_str(".app"); }

            let mut final_path = workspace_dir.join(&exe_filename);
            if !final_path.exists() {
                let alt_name = name_clone.replace(" ", "_");
                let mut alt_filename = alt_name.clone();
                #[cfg(target_os = "windows")] alt_filename.push_str(".exe");
                #[cfg(target_os = "macos")] alt_filename.push_str(".app");
                let alt_path = workspace_dir.join(&alt_filename);
                if alt_path.exists() { final_path = alt_path; }
                else if let Ok(entries) = fs::read_dir(&workspace_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
                        #[cfg(target_os = "windows")] let is_match = ext == "exe";
                        #[cfg(not(target_os = "windows"))] let is_match = ext == "app" || ext == "dmg" || ext == "deb" || ext == "AppImage";
                        if is_match { final_path = path; break; }
                    }
                }
            }

            let mut current_wapps = load_wapps(app_handle_clone.clone());
            let path_str = final_path.to_string_lossy().to_string();

            if let Some(pos) = current_wapps.iter().position(|w| w.id == id_str) {
                current_wapps[pos] = WappConfig { id: id_str.clone(), name: name_clone.clone(), url: url_clone.clone(), icon: icon.clone(), width, height, hide_title_bar, category: category_clone.clone(), created_at: created_at.clone(), path: path_str.clone() };
            } else {
                current_wapps.push(WappConfig { id: id_str.clone(), name: name_clone.clone(), url: url_clone.clone(), icon: icon.clone(), width, height, hide_title_bar, category: category_clone.clone(), created_at: created_at.clone(), path: path_str.clone() });
            }

            let _ = save_wapps(app_handle_clone.clone(), current_wapps);
            let _ = launch_wapp(path_str);

            let _ = app_handle_clone.emit(
                "build-progress",
                BuildProgress {
                    app_id: id_str.clone(),
                    message: format!("Successfully packaged {}! Launching now...", name_clone),
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
pub fn launch_wapp(path: String) -> Result<(), String> {
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
pub fn open_workspace_folder(app_handle: AppHandle) -> Result<(), String> {
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
