use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub fn get_workspace_dir(app_handle: &AppHandle) -> PathBuf {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let workspace = data_dir.join("wapps_workspace");
    if !workspace.exists() {
        let _ = fs::create_dir_all(&workspace);
    }
    workspace
}

pub fn get_config_file_path(app_handle: &AppHandle) -> PathBuf {
    get_workspace_dir(app_handle).join("wapps.json")
}
