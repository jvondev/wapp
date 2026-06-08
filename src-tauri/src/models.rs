use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WappConfig {
    pub id: String,
    pub name: String,
    pub url: String,
    pub icon: Option<String>,
    pub width: u32,
    pub height: u32,
    pub hide_title_bar: bool,
    pub maximize: bool,
    pub category: String,
    pub created_at: String,
    pub path: String,
}

#[derive(Clone, Serialize, Debug)]
pub struct BuildProgress {
    pub app_id: String,
    pub message: String,
    pub status: String, // "running", "success", "error"
}


#[derive(Serialize, Debug)]
pub struct SiteInfo {
    pub title: Option<String>,
    pub icon: Option<String>,
}
