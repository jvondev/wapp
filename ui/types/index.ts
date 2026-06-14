export interface BuildInput {
  name: string;
  url: string;
  category: string;
  width: number;
  height: number;
  hideTitle: boolean;
  maximize: boolean;
  os: string[];
}

export interface EditInput {
  name: string;
  url: string;
  category: string;
  width: number;
  height: number;
  hideTitle: boolean;
  maximize: boolean;
}

export interface WappConfig {
  id: string;
  name: string;
  url: string;
  icon: string | null;
  width: number;
  height: number;
  hide_title_bar: boolean;
  maximize: boolean;
  category: string;
  created_at: string;
  path: string;
}

export interface BuildProgressEvent {
  app_id: string;
  message: string;
  status: "running" | "success" | "error";
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
