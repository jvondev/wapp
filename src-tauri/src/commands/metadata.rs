use crate::models::SiteInfo;
use base64::Engine;
use scraper::{Html, Selector};

const MODERN_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

#[tauri::command]
pub async fn get_site_info(url: String) -> Result<SiteInfo, String> {
    let target_url = if !url.starts_with("http://") && !url.starts_with("https://") {
        format!("https://{}", url)
    } else {
        url
    };

    let response = reqwest::Client::new()
        .get(&target_url)
        .header(reqwest::header::USER_AGENT, MODERN_USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch URL: {}", e))?;

    let html_content = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let (title, icon_raw) = {
        let document = Html::parse_document(&html_content);
        let mut icon_found = None;

        let og_title_selector = Selector::parse("meta[property='og:title']").unwrap();
        let title_selector = Selector::parse("title").unwrap();

        let title = document
            .select(&og_title_selector)
            .next()
            .and_then(|m| m.value().attr("content"))
            .map(|s| s.to_string())
            .or_else(|| {
                document
                    .select(&title_selector)
                    .next()
                    .map(|t| t.inner_html())
            });

        let icon_selectors = [
            "link[rel='apple-touch-icon']",
            "link[rel='icon']",
            "link[rel='shortcut icon']",
            "meta[property='og:image']",
        ];
        for selector_str in icon_selectors {
            let sel = Selector::parse(selector_str).unwrap();
            if let Some(link) = document.select(&sel).next() {
                let attr = if selector_str.starts_with("meta") {
                    "content"
                } else {
                    "href"
                };
                if let Some(raw) = link.value().attr(attr) {
                    let mut icon_path = raw.to_string();
                    if icon_path.starts_with("//") {
                        icon_path = format!("https:{}", icon_path);
                    } else if icon_path.starts_with("/") || !icon_path.starts_with("http") {
                        if let Ok(base) = url::Url::parse(&target_url) {
                            if let Ok(resolved) = base.join(&icon_path) {
                                icon_path = resolved.into();
                            }
                        }
                    }
                    icon_found = Some(icon_path);
                    break;
                }
            }
        }
        (title, icon_found)
    };

    let mut icon = icon_raw;

    if icon.is_none() {
        if let Ok(base) = url::Url::parse(&target_url) {
            if let Ok(favicon_url) = base.join("favicon.ico") {
                icon = Some(favicon_url.into());
            }
        }
    }

    if let Some(ref icon_url) = icon {
        if let Ok(icon_res) = reqwest::Client::new()
            .get(icon_url)
            .header(reqwest::header::USER_AGENT, MODERN_USER_AGENT)
            .send()
            .await
        {
            if let Ok(bytes) = icon_res.bytes().await {
                let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                let mime = guess_mime(icon_url);
                icon = Some(format!("data:{};base64,{}", mime, b64));
            }
        }
    }

    Ok(SiteInfo { title, icon })
}

fn guess_mime(url: &str) -> &'static str {
    if url.ends_with(".png") {
        "image/png"
    } else if url.ends_with(".ico") {
        "image/x-icon"
    } else if url.ends_with(".jpg") || url.ends_with(".jpeg") {
        "image/jpeg"
    } else if url.ends_with(".svg") {
        "image/svg+xml"
    } else {
        "image/x-icon"
    }
}
