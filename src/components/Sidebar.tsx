import { Component, Show } from "solid-js";
import { Folder, Settings, Plus } from "lucide-solid";
import { DependencyStatus } from "../types";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: "all" | "settings") => void;
  onAddClick: () => void;
  depStatus: DependencyStatus | null;
  isCheckingDeps: boolean;
  onCheckDeps: () => void;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  return (
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-logo">w</div>
        <span class="brand-name">wapp</span>
      </div>

      <button class="sidebar-add-btn" onClick={props.onAddClick}>
        <Plus size={18} />
        New Wapp
      </button>

      <nav class="nav-group">
        <button 
          class="nav-item" 
          classList={{ active: props.activeTab === "all" }}
          onClick={() => props.setActiveTab("all")}
        >
          <Folder size={16} />
          All Wapps
        </button>
        <button 
          class="nav-item" 
          classList={{ active: props.activeTab === "settings" }}
          onClick={() => props.setActiveTab("settings")}
        >
          <Settings size={16} />
          Setup Guide
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="status-badge" onClick={props.onCheckDeps} style="cursor: pointer;">
          <div 
            class="status-dot" 
            classList={{ 
              active: !!props.depStatus?.node_installed && !!props.depStatus?.rust_installed, 
              inactive: !props.depStatus?.node_installed || !props.depStatus?.rust_installed 
            }} 
          />
          <span>
            {props.isCheckingDeps 
              ? "Checking..." 
              : props.depStatus?.node_installed && props.depStatus?.rust_installed 
                ? "System Ready" 
                : "Setup Required"
            }
          </span>
        </div>
      </div>
    </aside>
  );
};
