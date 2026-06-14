use tauri::AppHandle;
use std::path::{Path, PathBuf};
use std::fs;
use tauri::Manager;

/// Returns the path to the base binary for a given target OS.
/// In Development, it looks in the target folder.
/// In Production, it looks in the bundled resources.
pub fn get_base_binary_path(app: &AppHandle, target_os: &str) -> PathBuf {
    let bin_name = match target_os {
        "windows" => "wapp-base.exe",
        "mac" => "wapp-base",
        "linux" => "wapp-base",
        _ => "wapp-base",
    };

    // 1. Try to find it in the resource directory (Production)
    if let Ok(resource_dir) = app.path().resource_dir() {
        let path = resource_dir.join("bin").join(bin_name);
        if path.exists() {
            return path;
        }
    }

    // 2. Try to find it in the same directory as the executable (Development)
    // Note: This assumes the host OS matches the target OS during development.
    // For cross-compilation during dev, we'd need more complex logic.
    if let Ok(mut p) = std::env::current_exe() {
        p.pop(); // pop builder exe
        let path = p.join(bin_name);
        if path.exists() {
            return path;
        }
    }

    // 3. Fallback to current dir for simplicity in some dev environments
    PathBuf::from(bin_name)
}

pub fn copy_or_dummy(src: &Path, dest: &Path) -> Result<(), String> {
    if src.exists() {
        fs::copy(src, dest).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("Base binary not found at {}. Please run 'cargo build --bin wapp-base' first.", src.display()))
    }
}
