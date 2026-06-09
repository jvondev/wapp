import { invoke } from "@tauri-apps/api/core";
import { WappConfig, SiteInfo } from "../types";

export const tauriService = {
  loadWapps: () => invoke<WappConfig[]>("load_wapps"),
  
  saveWapps: (wapps: WappConfig[]) => invoke<void>("save_wapps", { wapps }),
  
  deleteWapp: (id: string) => invoke<void>("delete_wapp", { id }),
  
  editWapp: (args: {
    id: string;
    name: string;
    url: string;
    icon: string | null;
    width: number;
    height: number;
    hideTitleBar: boolean;
    maximize: boolean;
    category: string;
  }) => invoke<void>("edit_wapp", args),
  
  buildWapp: (args: {
    id: string;
    name: string;
    url: string;
    icon: string | null;
    width: number;
    height: number;
    hideTitleBar: boolean;
    category: string;
    createdAt: string;
    maximize: boolean;
    os: string[];
  }) => invoke<void>("build_wapp", args),

  launchWapp: (path: string) => invoke<void>("launch_wapp", { path }),

  openWorkspaceFolder: () => invoke<void>("open_workspace_folder"),

  getSiteInfo: (url: string) => invoke<SiteInfo>("get_site_info", { url }),

  openPreview: (args: { url: string; x: number; y: number; width: number; height: number }) =>
    invoke<void>("open_preview", args),

  updatePreviewBounds: (args: { x: number; y: number; width: number; height: number }) =>
    invoke<void>("update_preview_bounds", args),

  closePreview: () => invoke<void>("close_preview"),
};
