// Shared Interface Definitions

export interface WappConfig {
  id: string;
  name: string;
  url: string;
  icon: string | null;
  width: number;
  height: number;
  hide_title_bar: boolean;
  category: string;
  created_at: string;
  path: string;
}

export interface DependencyStatus {
  node_installed: boolean;
  rust_installed: boolean;
  pake_installed: boolean;
  node_version: string;
  rust_version: string;
}

export interface BuildProgressEvent {
  app_id: string;
  message: string;
  status: string; // "running" | "success" | "error"
}

export interface InstallProgressEvent {
  message: string;
  status: string; // "running" | "error" | "done"
}

export interface ActiveBuild {
  id: string;
  name: string;
  url: string;
  logs: string[];
  state: "building" | "success" | "error";
  category: string;
}

export interface SiteInfo {
  title: string | null;
  icon: string | null;
}
