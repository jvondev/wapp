use serde::Deserialize;
use std::path::PathBuf;

#[derive(Deserialize, Debug)]
struct WappRuntimeConfig {
    url: String,
    #[serde(default = "default_name")]
    name: String,
    icon: Option<String>,
    #[serde(default = "default_width")]
    width: f64,
    #[serde(default = "default_height")]
    height: f64,
    #[serde(default)]
    hide_title_bar: bool,
    #[serde(default)]
    maximize: bool,
}

fn default_name() -> String {
    "App".to_string()
}
fn default_width() -> f64 {
    1200.0
}
fn default_height() -> f64 {
    780.0
}

fn get_config_path() -> PathBuf {
    std::env::current_exe()
        .expect("cannot resolve exe path")
        .parent()
        .expect("exe has no parent dir")
        .join("wapp.config.json")
}

fn load_config() -> WappRuntimeConfig {
    let path = get_config_path();
    let raw = std::fs::read_to_string(&path)
        .unwrap_or_else(|_| r#"{"url":"about:blank","name":"App"}"#.to_string());
    serde_json::from_str(&raw).unwrap_or_else(|_| WappRuntimeConfig {
        url: "about:blank".to_string(),
        name: "App".to_string(),
        icon: None,
        width: 1200.0,
        height: 780.0,
        hide_title_bar: false,
        maximize: false,
    })
}

fn decode_base64_icon(data_url: &str) -> Option<tauri::image::Image<'static>> {
    let parts: Vec<&str> = data_url.split(',').collect();
    if parts.len() != 2 {
        return None;
    }
    let base64_data = parts[1];

    use base64::{engine::general_purpose, Engine as _};
    if let Ok(bytes) = general_purpose::STANDARD.decode(base64_data) {
        if let Ok(img) = tauri::image::Image::from_bytes(&bytes) {
            return Some(img.to_owned());
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = load_config();
    let url_str = config.url.clone();
    let title = config.name.clone();
    let width = config.width;
    let height = config.height;
    let hide_title_bar = config.hide_title_bar;
    let maximize = config.maximize;
    let icon = config.icon.clone();

    tauri::Builder::default()
        .setup(move |app| {
            let normalized = if url_str.contains("://") {
                url_str.clone()
            } else {
                format!("https://{}", url_str)
            };
            let parsed_url: url::Url = normalized
                .parse()
                .unwrap_or_else(|_| "about:blank".parse().unwrap());

            let mut builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::External(parsed_url),
            )
            .title(&title)
            .inner_size(width, height)
            .decorations(!hide_title_bar);

            if maximize {
                builder = builder.maximized(true);
            }

            if let Some(icon_str) = &icon {
                if let Some(img) = decode_base64_icon(icon_str) {
                    #[cfg(target_os = "macos")]
                    let _ = app.handle().set_icon(img.clone());

                    builder = builder.icon(img).expect("failed to set icon");
                }
            }

            builder.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running wapp-base");
}
