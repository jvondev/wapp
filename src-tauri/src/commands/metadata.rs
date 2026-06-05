use crate::models::SiteInfo;
use scraper::{Html, Selector};
use reqwest::header::USER_AGENT;

const MODERN_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

#[tauri::command]
pub async fn get_site_info(url: String) -> Result<SiteInfo, String> {
    let mut target_url = url.clone();
    if !target_url.starts_with("http") {
        target_url = format!("https://{}", target_url);
    }

    let client = reqwest::Client::new();
    let response = client.get(&target_url)
        .header(USER_AGENT, MODERN_USER_AGENT)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let html_content = response.text().await.map_err(|e| e.to_string())?;
    let document = Html::parse_document(&html_content);
    
    let mut title = None;
    let mut icon = None;

    // 1. Try OpenGraph Title then fallback to <title>
    let og_title_selector = Selector::parse("meta[property='og:title']").unwrap();
    let title_selector = Selector::parse("title").unwrap();

    if let Some(meta) = document.select(&og_title_selector).next() {
        title = meta.value().attr("content").map(|s| s.to_string());
    }
    
    if title.is_none() {
        if let Some(t) = document.select(&title_selector).next() {
            title = Some(t.inner_html());
        }
    }

    // 2. Try high-res icons (apple-touch-icon, then rel icon)
    let icon_selectors = vec![
        "link[rel='apple-touch-icon']",
        "link[rel='icon']",
        "link[rel='shortcut icon']",
        "meta[property='og:image']",
    ];

    for selector_str in icon_selectors {
        let selector = Selector::parse(selector_str).unwrap();
        if let Some(link) = document.select(&selector).next() {
            let attr = if selector_str.contains("meta") { "content" } else { "href" };
            if let Some(href) = link.value().attr(attr) {
                let mut icon_path = href.to_string();
                
                // Resolve relative URLs
                if icon_path.starts_with("//") {
                    icon_path = format!("https:{}", icon_path);
                } else if icon_path.starts_with("/") {
                    if let Ok(parsed_url) = url::Url::parse(&target_url) {
                        icon_path = format!("{}://{}{}", parsed_url.scheme(), parsed_url.host_str().unwrap_or(""), icon_path);
                    }
                } else if !icon_path.starts_with("http") {
                    if let Ok(parsed_url) = url::Url::parse(&target_url) {
                        let base = format!("{}://{}/", parsed_url.scheme(), parsed_url.host_str().unwrap_or(""));
                        icon_path = format!("{}{}", base, icon_path);
                    }
                }
                icon = Some(icon_path);
                break;
            }
        }
    }

    // 3. Fallback to basic /favicon.ico
    if icon.is_none() {
        if let Ok(parsed_url) = url::Url::parse(&target_url) {
            icon = Some(format!("{}://{}/favicon.ico", parsed_url.scheme(), parsed_url.host_str().unwrap_or("")));
        }
    }

    Ok(SiteInfo { title, icon })
}
