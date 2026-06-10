use crate::models::{BuildProgress, WappConfig};
use crate::utils::{get_config_file_path, get_workspace_dir};
use base64::{engine::general_purpose, Engine as _};
use image::DynamicImage;
use std::fs::{self, File};
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Emitter, Manager};

// ---------------------------------------------------------------------------
// ICO / ICNS generators (used as temp files for rcedit / macOS)
// ---------------------------------------------------------------------------

fn generate_ico(img: &DynamicImage) -> Result<Vec<u8>, String> {
    let sizes: &[u32] = &[256, 128, 64, 48, 32, 16];
    let mut icon_dir = ico::IconDir::new(ico::ResourceType::Icon);
    for &sz in sizes {
        let resized = img.resize_exact(sz, sz, image::imageops::FilterType::Lanczos3);
        let rgba = resized.to_rgba8();
        let icon_image = ico::IconImage::from_rgba_data(sz, sz, rgba.into_raw());
        let entry = ico::IconDirEntry::encode(&icon_image).map_err(|e| e.to_string())?;
        icon_dir.add_entry(entry);
    }
    let mut cursor = Cursor::new(Vec::new());
    icon_dir.write(&mut cursor).map_err(|e| e.to_string())?;
    Ok(cursor.into_inner())
}

fn generate_icns(img: &DynamicImage) -> Result<Vec<u8>, String> {
    let mut family = icns::IconFamily::new();
    let mut png_bytes = Cursor::new(Vec::new());
    img.write_to(&mut png_bytes, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    let image =
        icns::Image::read_png(png_bytes.into_inner().as_slice()).map_err(|e| e.to_string())?;
    family.add_icon(&image).map_err(|e| e.to_string())?;
    let mut cursor = Cursor::new(Vec::new());
    family.write(&mut cursor).map_err(|e| e.to_string())?;
    Ok(cursor.into_inner())
}

// ---------------------------------------------------------------------------
// rcedit helper — download once into workspace/.tools/rcedit.exe
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
fn ensure_rcedit(workspace_dir: &Path) -> Result<PathBuf, String> {
    let tools_dir = workspace_dir.join(".tools");
    let _ = fs::create_dir_all(&tools_dir);
    let rcedit = tools_dir.join("rcedit.exe");
    if rcedit.exists() {
        return Ok(rcedit);
    }

    let url = "https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe";
    let status = Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &format!(
                "Invoke-WebRequest -Uri '{}' -OutFile '{}' -UseBasicParsing",
                url,
                rcedit.to_string_lossy()
            ),
        ])
        .status()
        .map_err(|e| format!("powershell spawn: {}", e))?;

    if !status.success() {
        return Err("Failed to download rcedit.exe".to_string());
    }
    Ok(rcedit)
}

// ---------------------------------------------------------------------------
// Apply icon to built artifact
// ---------------------------------------------------------------------------

fn apply_icon_cross_platform(
    app_target_path: &Path,
    icon_base64: &str,
    workspace_dir: &Path,
    target_os: &str,
) -> Result<(), String> {
    let parts: Vec<&str> = icon_base64.split(',').collect();
    if parts.len() != 2 {
        return Err("Invalid icon data format".into());
    }
    let bytes = general_purpose::STANDARD
        .decode(parts[1])
        .map_err(|e| e.to_string())?;
    let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;

    if target_os == "windows" {
        let ico_bytes = generate_ico(&img)?;
        let ico_tmp = workspace_dir.join(".tools").join(format!(
            "__icon_tmp_{}.ico",
            std::time::UNIX_EPOCH.elapsed().unwrap().as_millis()
        ));
        let _ = fs::create_dir_all(ico_tmp.parent().unwrap());
        fs::write(&ico_tmp, &ico_bytes).map_err(|e| e.to_string())?;

        // Try to apply using rcedit if on Windows host
        #[cfg(target_os = "windows")]
        {
            match ensure_rcedit(workspace_dir) {
                Ok(rcedit) => {
                    let status = Command::new(&rcedit)
                        .args([
                            app_target_path.to_str().unwrap_or(""),
                            "--set-icon",
                            ico_tmp.to_str().unwrap_or(""),
                        ])
                        .status()
                        .map_err(|e| e.to_string())?;
                    let _ = fs::remove_file(&ico_tmp);
                    if !status.success() {
                        return Err("rcedit failed to set icon".to_string());
                    }
                }
                Err(e) => {
                    let _ = fs::remove_file(&ico_tmp);
                    return Err(format!("rcedit unavailable: {}", e));
                }
            }
        }
        // If not on Windows host, we can't easily patch Windows EXE PE headers natively without a full crate
        #[cfg(not(target_os = "windows"))]
        {
            let _ = fs::remove_file(&ico_tmp);
            return Err("Cannot patch Windows EXE icon from non-Windows host yet".into());
        }
    } else if target_os == "mac" {
        // app_target_path is the .app bundle
        let icns_bytes = generate_icns(&img)?;
        let resources_dir = app_target_path.join("Contents").join("Resources");
        let _ = fs::create_dir_all(&resources_dir);
        fs::write(resources_dir.join("icon.icns"), &icns_bytes).map_err(|e| e.to_string())?;
    } else {
        // Linux
        let icon_path = app_target_path.with_extension("png");
        img.save(&icon_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Public commands
// ---------------------------------------------------------------------------

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
    os: Vec<String>,
) -> Result<(), String> {
    let app_handle_clone = app_handle.clone();
    let id_clone = id.clone();
    let name_clone = name.clone();
    let url_clone = url.clone();
    let category_clone = category.clone();
    let created_at_clone = created_at.clone();

    std::thread::spawn(move || {
        let workspace_dir = get_workspace_dir(&app_handle_clone);
        let id_str = id_clone.clone();

        let emit = |msg: &str, status: &str| {
            let _ = app_handle_clone.emit(
                "build-progress",
                BuildProgress {
                    app_id: id_str.clone(),
                    message: msg.to_string(),
                    status: status.to_string(),
                },
            );
        };

        emit(
            &format!("Initializing build for {}...", name_clone),
            "running",
        );

        let safe_name =
            name_clone.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");
        let app_folder = workspace_dir.join(&safe_name);
        let _ = fs::create_dir_all(&app_folder);

        let resource_dir = app_handle_clone.path().resource_dir().unwrap_or_default();
        let os_list = if os.is_empty() {
            vec!["windows".to_string()]
        } else {
            os.clone()
        };

        let mut first_built_path: Option<PathBuf> = None;

        for target_os_str in &os_list {
            let target_os = target_os_str.as_str();
            let fmt = match target_os {
                "mac" => "app",
                "linux" => "AppImage",
                _ => "exe",
            };

            emit(
                &format!("Building for {}: {}...", target_os, fmt),
                "running",
            );

            // Select correct base binary
            let base_bin_name = match target_os {
                "mac" => "wapp-base-mac",
                "linux" => "wapp-base-linux",
                _ => "wapp-base.exe",
            };
            let base_exe_path = resource_dir.join("bin").join(base_bin_name);

            let (final_exe_path, config_path) =
                build_for_format(&app_folder, &name_clone, fmt, target_os, &base_exe_path);

            // Write runtime config
            let runtime_config = serde_json::json!({
                "url": url_clone,
                "name": name_clone,
                "icon": icon.clone(),
                "width": width,
                "height": height,
                "hide_title_bar": hide_title_bar,
                "maximize": maximize
            });
            let _ = fs::write(
                &config_path,
                serde_json::to_string_pretty(&runtime_config).unwrap(),
            );

            // Apply icon based on target OS
            if let Some(ref icon_data) = icon {
                match apply_icon_cross_platform(
                    &final_exe_path,
                    icon_data,
                    &workspace_dir,
                    target_os,
                ) {
                    Ok(_) => emit(
                        &format!("Icon applied for {} [{}]", name_clone, fmt),
                        "running",
                    ),
                    Err(e) => emit(&format!("Icon skipped ({})", e), "running"),
                }
            }

            emit(&format!("[{}] {} is ready!", fmt, name_clone), "running");

            if first_built_path.is_none() {
                first_built_path = Some(final_exe_path.clone());
            }
        }

        let path_str = first_built_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        // Update state
        let mut current_wapps = load_wapps(app_handle_clone.clone());
        let new_wapp = WappConfig {
            id: id_str.clone(),
            name: name_clone.clone(),
            url: url_clone.clone(),
            icon: icon.clone(),
            width,
            height,
            hide_title_bar,
            maximize,
            category: category_clone.clone(),
            created_at: created_at_clone.clone(),
            path: path_str.clone(),
        };

        if let Some(pos) = current_wapps.iter().position(|w| w.id == id_str) {
            current_wapps[pos] = new_wapp;
        } else {
            current_wapps.push(new_wapp);
        }
        let _ = save_wapps(app_handle_clone.clone(), current_wapps);

        std::thread::sleep(std::time::Duration::from_millis(50));
        let _ = launch_wapp(path_str);

        emit(&format!("Successfully built {}!", name_clone), "success");
    });

    Ok(())
}

/// Copy base exe into a format-specific subdirectory, return (exe_path, config_path).
fn build_for_format(
    app_folder: &Path,
    name: &str,
    fmt: &str,
    target_os: &str,
    base_exe_path: &Path,
) -> (PathBuf, PathBuf) {
    let fmt_dir = app_folder.join(fmt);
    let _ = fs::create_dir_all(&fmt_dir);

    if target_os == "mac" {
        let bundle_name = format!("{}.app", name);
        let bundle = fmt_dir.join(&bundle_name);
        let macos_dir = bundle.join("Contents").join("MacOS");
        let _ = fs::create_dir_all(&macos_dir);
        let dest = macos_dir.join(name);
        copy_or_dummy(base_exe_path, &dest);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&dest, fs::Permissions::from_mode(0o755));
        }
        let config = macos_dir.join("wapp.config.json");
        (bundle, config)
    } else {
        let ext = if target_os == "windows" { ".exe" } else { "" };
        let exe_name = format!("{}{}", name, ext);
        let exe = fmt_dir.join(&exe_name);
        copy_or_dummy(base_exe_path, &exe);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&exe, fs::Permissions::from_mode(0o755));
        }
        let config = fmt_dir.join("wapp.config.json");
        (exe, config)
    }
}

fn copy_or_dummy(src: &Path, dest: &Path) {
    if src.exists() {
        let _ = fs::copy(src, dest);
    } else {
        let _ = fs::write(dest, b"PLACEHOLDER");
    }
}

// ---------------------------------------------------------------------------

#[tauri::command]
pub fn launch_wapp(path: String) -> Result<(), String> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err("App executable not found. Rebuild it.".to_string());
    }

    #[cfg(target_os = "windows")]
    Command::new("cmd")
        .arg("/C")
        .arg("start")
        .arg("")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn open_workspace_folder(app_handle: AppHandle) -> Result<(), String> {
    let path = get_workspace_dir(&app_handle);
    #[cfg(target_os = "windows")]
    Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_wapp(app_handle: AppHandle, id: String) -> Result<(), String> {
    let mut current_wapps = load_wapps(app_handle.clone());

    if let Some(pos) = current_wapps.iter().position(|w| w.id == id) {
        let wapp = &current_wapps[pos];
        let path = Path::new(&wapp.path);

        // app_folder is the parent of the fmt subdir
        let app_folder = path
            .parent()
            .and_then(|p| p.parent())
            .map(|p| p.to_path_buf());

        if let Some(folder) = app_folder {
            let _ = fs::remove_dir_all(&folder);
        }

        current_wapps.remove(pos);
        let _ = save_wapps(app_handle.clone(), current_wapps);
        Ok(())
    } else {
        Err("App not found".to_string())
    }
}

#[derive(serde::Deserialize)]
pub struct EditWappInput {
    id: String,
    name: String,
    url: String,
    icon: Option<String>,
    width: u32,
    height: u32,
    hide_title_bar: bool,
    maximize: bool,
    category: String,
}

#[tauri::command]
pub fn edit_wapp(app_handle: tauri::AppHandle, input: EditWappInput) -> Result<(), String> {
    let workspace_dir = get_workspace_dir(&app_handle);
    let mut current_wapps = load_wapps(app_handle.clone());

    if let Some(pos) = current_wapps.iter().position(|w| w.id == input.id) {
        let mut wapp = current_wapps[pos].clone();
        wapp.name = input.name.clone();
        wapp.url = input.url.clone();
        wapp.icon = input.icon.clone();
        wapp.width = input.width;
        wapp.height = input.height;
        wapp.hide_title_bar = input.hide_title_bar;
        wapp.maximize = input.maximize;
        wapp.category = input.category.clone();

        let exe_path = PathBuf::from(&wapp.path);
        let is_mac_app = wapp.path.ends_with(".app");
        let config_path = if is_mac_app {
            exe_path
                .join("Contents")
                .join("MacOS")
                .join("wapp.config.json")
        } else {
            exe_path.parent().unwrap().join("wapp.config.json")
        };

        let runtime_config = serde_json::json!({
            "url": wapp.url,
            "name": wapp.name,
            "icon": wapp.icon,
            "width": wapp.width,
            "height": wapp.height,
            "hide_title_bar": wapp.hide_title_bar,
            "maximize": wapp.maximize
        });
        let _ = fs::write(
            &config_path,
            serde_json::to_string_pretty(&runtime_config).unwrap(),
        );

        if let Some(ref icon_data) = wapp.icon {
            let target_os = if is_mac_app {
                "mac"
            } else if wapp.path.ends_with(".exe") {
                "windows"
            } else {
                "linux"
            };
            let _ = apply_icon_cross_platform(&exe_path, icon_data, &workspace_dir, target_os);
        }

        current_wapps[pos] = wapp;
        let _ = save_wapps(app_handle, current_wapps);
        Ok(())
    } else {
        Err("Wapp not found".into())
    }
}
