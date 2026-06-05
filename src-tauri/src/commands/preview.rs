use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl, webview::WebviewBuilder};

#[tauri::command]
pub async fn open_preview(
    app_handle: AppHandle,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    // Get the Window instance directly for add_child
    let window = app_handle.get_window("main").ok_or("Main window not found")?;
    
    // Check if child webview already exists (webview labels are global)
    if let Some(preview) = app_handle.get_webview("preview") {
        let _ = preview.navigate(url.parse().map_err(|e| format!("Invalid URL: {}", e))?);
        let _ = preview.set_position(LogicalPosition::new(x, y));
        let _ = preview.set_size(LogicalSize::new(width, height));
        let _ = preview.show();
        return Ok(());
    }

    // In Tauri v2, add_child is an inherent method on Window (requires 'unstable' feature)
    let builder = WebviewBuilder::new("preview", WebviewUrl::External(url.parse().map_err(|e| format!("Invalid URL: {}", e))?));
    
    let _preview = window.add_child(
        builder,
        LogicalPosition::new(x, y),
        LogicalSize::new(width, height),
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn update_preview_bounds(
    app_handle: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if let Some(preview) = app_handle.get_webview("preview") {
        let _ = preview.set_position(LogicalPosition::new(x, y));
        let _ = preview.set_size(LogicalSize::new(width, height));
    }
    Ok(())
}

#[tauri::command]
pub async fn close_preview(app_handle: AppHandle) -> Result<(), String> {
    if let Some(preview) = app_handle.get_webview("preview") {
        let _ = preview.hide();
    }
    Ok(())
}
