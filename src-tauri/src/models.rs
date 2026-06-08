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

#[derive(Serialize, Debug)]
pub struct DependencyStatus {
    pub node_installed: bool,
    pub rust_installed: bool,
    pub pake_installed: bool,
    pub node_version: String,
    pub rust_version: String,
}

#[derive(Clone, Serialize, Debug)]
pub struct BuildProgress {
    pub app_id: String,
    pub message: String,
    pub status: String, // "running", "success", "error"
}

#[derive(Clone, Serialize, Debug)]
pub struct InstallProgress {
    pub message: String,
    pub status: String, // "running" | "success" | "error" | "done"
}

#[derive(Serialize, Debug)]
pub struct SiteInfo {
    pub title: Option<String>,
    pub icon: Option<String>,
}
