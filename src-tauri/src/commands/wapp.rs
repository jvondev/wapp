use std::process::{Command, Stdio};
use std::path::Path;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use tauri::{AppHandle, Emitter, Manager};
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
                message: format!("Generating app for {}...", name_clone),
                status: "running".to_string(),
            },
        );

        // 1. Create specific folder for this app
        let safe_name = name_clone.replace(|c: char| !c.is_alphanumeric(), "_");
        let app_folder = workspace_dir.join(&safe_name);
        let _ = fs::create_dir_all(&app_folder);

        let mut exe_ext = "";
        #[cfg(target_os = "windows")] { exe_ext = ".exe"; }
        #[cfg(target_os = "macos")] { exe_ext = ".app"; }

        // 2. Find bundled base binary
        let resource_dir = app_handle_clone.path().resource_dir().unwrap_or_default();
        let base_exe_name = format!("wapp-base{}", exe_ext);
        let base_exe_path = resource_dir.join("base-bin").join(&base_exe_name);

        let final_exe_name = format!("{}{}", name_clone, exe_ext);
        let final_exe_path = app_folder.join(&final_exe_name);

        // 3. Instant Copy
        if !base_exe_path.exists() {
            // For Dev Mode: If CI hasn't run yet to bundle base, simulate it.
            let _ = fs::write(&final_exe_path, "DUMMY EXE CONTENT (Run CI to get real binary)");
        } else {
             #[cfg(target_os = "macos")]
             {
                 let _ = Command::new("cp").arg("-r").arg(&base_exe_path).arg(&final_exe_path).status();
             }
             #[cfg(not(target_os = "macos"))]
             {
                 let _ = fs::copy(&base_exe_path, &final_exe_path);
             }
        }

        // 4. Write JSON config payload
        let config_path = if cfg!(target_os = "macos") {
             final_exe_path.join("Contents").join("MacOS").join("wapp.config.json")
        } else {
             app_folder.join("wapp.config.json")
        };

        if let Some(p) = config_path.parent() {
            let _ = fs::create_dir_all(p);
        }

        let runtime_config = serde_json::json!({
             "url": url_clone,
             "name": name_clone,
             "width": width,
             "height": height,
             "hide_title_bar": hide_title_bar,
             "maximize": maximize
        });

        let _ = fs::write(&config_path, serde_json::to_string_pretty(&runtime_config).unwrap());

        // 5. Update State
        let path_str = final_exe_path.to_string_lossy().to_string();
        let mut current_wapps = load_wapps(app_handle_clone.clone());

        if let Some(pos) = current_wapps.iter().position(|w| w.id == id_str) {
            current_wapps[pos] = WappConfig { id: id_str.clone(), name: name_clone.clone(), url: url_clone.clone(), icon: icon.clone(), width, height, hide_title_bar, category: category_clone.clone(), created_at: created_at.clone(), path: path_str.clone() };
        } else {
            current_wapps.push(WappConfig { id: id_str.clone(), name: name_clone.clone(), url: url_clone.clone(), icon: icon.clone(), width, height, hide_title_bar, category: category_clone.clone(), created_at: created_at.clone(), path: path_str.clone() });
        }

        let _ = save_wapps(app_handle_clone.clone(), current_wapps);
        
        // Let UI show success before launch
        std::thread::sleep(std::time::Duration::from_millis(50));
        
        let _ = launch_wapp(path_str);

        let _ = app_handle_clone.emit(
            "build-progress",
            BuildProgress {
                app_id: id_str.clone(),
                message: format!("Successfully generated {} instantly!", name_clone),
                status: "success".to_string(),
            },
        );
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
        Command::new("cmd").arg("/C").arg("start").arg("").arg(path).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(path).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open").arg(path).spawn().map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn open_workspace_folder(app_handle: AppHandle) -> Result<(), String> {
    let path = get_workspace_dir(&app_handle);
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer").arg(&path).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open").arg(&path).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_wapp(app_handle: AppHandle, id: String) -> Result<(), String> {
    let mut current_wapps = load_wapps(app_handle.clone());
    
    // Find app and its path
    if let Some(pos) = current_wapps.iter().position(|w| w.id == id) {
        let wapp = &current_wapps[pos];
        let path = Path::new(&wapp.path);
        
        // The path points to the executable. We need to delete its parent directory
        // because the parent directory is the specific app folder we created.
        if let Some(parent) = path.parent() {
            // Delete the physical files
            let _ = fs::remove_dir_all(parent);
        }
        
        // Remove from config
        current_wapps.remove(pos);
        let _ = save_wapps(app_handle.clone(), current_wapps);
        Ok(())
    } else {
        Err("App not found".to_string())
    }
}
