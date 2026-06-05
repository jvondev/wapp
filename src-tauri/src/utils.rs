use std::process::{Command, Output};
use std::path::{Path, PathBuf};
use std::fs;
use tauri::{AppHandle, Manager};

pub fn run_shell_cmd(cmd: &str, args: &[&str]) -> std::io::Result<Output> {
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

pub fn refresh_path_env() {
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

pub fn get_workspace_dir(app_handle: &AppHandle) -> PathBuf {
    let data_dir = app_handle.path().app_data_dir().unwrap_or_else(|_| {
        PathBuf::from(".")
    });
    let workspace = data_dir.join("wapps_workspace");
    if !workspace.exists() {
        let _ = fs::create_dir_all(&workspace);
    }
    workspace
}

pub fn get_config_file_path(app_handle: &AppHandle) -> PathBuf {
    get_workspace_dir(app_handle).join("wapps.json")
}
