mod models;
mod utils;
mod commands;

use commands::{deps, wapp, metadata};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            deps::check_dependencies,
            deps::install_dependencies,
            wapp::load_wapps,
            wapp::save_wapps,
            wapp::build_wapp,
            wapp::launch_wapp,
            wapp::open_workspace_folder,
            metadata::get_site_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
