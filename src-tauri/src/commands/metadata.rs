use crate::models::SiteInfo;

#[tauri::command]
pub async fn get_site_info(url: String) -> Result<SiteInfo, String> {
    let mut target_url = url.clone();
    if !target_url.starts_with("http") {
        target_url = format!("https://{}", target_url);
    }

    let response = reqwest::get(&target_url)
        .await
        .map_err(|e| e.to_string())?;
    
    let html = response.text().await.map_err(|e| e.to_string())?;
    
    let mut title = None;
    let mut icon = None;

    // Simple parsing for title
    if let Some(t_start) = html.find("<title>") {
        if let Some(t_end) = html[t_start..].find("</title>") {
            title = Some(html[t_start + 7..t_start + t_end].to_string());
        }
    }

    // Simple parsing for icon
    let patterns = vec!["rel=\"icon\"", "rel=\"shortcut icon\"", "rel='icon'", "rel='shortcut icon'"];
    for pattern in patterns {
        if let Some(idx) = html.find(pattern) {
            let link_start = html[..idx].rfind("<link");
            if let Some(start) = link_start {
                let link_tag = &html[start..];
                if let Some(h_idx) = link_tag.find("href=") {
                    let quote = link_tag[h_idx+5..h_idx+6].to_string();
                    let h_start = h_idx + 6;
                    if let Some(h_end) = link_tag[h_start..].find(&quote) {
                        let mut icon_path = link_tag[h_start..h_start + h_end].to_string();
                        
                        if icon_path.starts_with("//") {
                             icon_path = format!("https:{}", icon_path);
                        } else if icon_path.starts_with("/") {
                            let parsed_url = url::Url::parse(&target_url).unwrap();
                            icon_path = format!("{}://{}{}", parsed_url.scheme(), parsed_url.host_str().unwrap_or(""), icon_path);
                        } else if !icon_path.starts_with("http") {
                             let parsed_url = url::Url::parse(&target_url).unwrap();
                             let base = format!("{}://{}/", parsed_url.scheme(), parsed_url.host_str().unwrap_or(""));
                             icon_path = format!("{}{}", base, icon_path);
                        }
                        icon = Some(icon_path);
                        break;
                    }
                }
            }
        }
    }

    if icon.is_none() {
        let parsed_url = url::Url::parse(&target_url).map_err(|e| e.to_string())?;
        icon = Some(format!("{}://{}/favicon.ico", parsed_url.scheme(), parsed_url.host_str().unwrap_or("")));
    }

    Ok(SiteInfo { title, icon })
}
