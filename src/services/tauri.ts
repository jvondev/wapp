import { invoke } from "@tauri-apps/api/core";
import { WappConfig, DependencyStatus, SiteInfo } from "../types";

export const tauriService = {
  checkDependencies: () => invoke<DependencyStatus>("check_dependencies"),
  
  installDependencies: () => invoke<void>("install_dependencies"),
  
  loadWapps: () => invoke<WappConfig[]>("load_wapps"),
  
  saveWapps: (wapps: WappConfig[]) => invoke<void>("save_wapps", { wapps }),
  
  buildWapp: (args: {
    id: string;
    name: string;
    url: string;
    icon: string | null;
    width: number;
    height: number;
    hide_title_bar: boolean;
    category: string;
    created_at: string;
    maximize: boolean;
  }) => invoke<void>("build_wapp", args),
  
  launchWapp: (path: string) => invoke<void>("launch_wapp", { path }),
  
  openWorkspaceFolder: () => invoke<void>("open_workspace_folder"),
  
  getSiteInfo: (url: string) => invoke<SiteInfo>("get_site_info", { url }),
};
