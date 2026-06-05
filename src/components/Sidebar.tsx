import { Component } from "solid-js";
import { Folder, Settings, Plus } from "lucide-solid";
import { useAppStore } from "../store";

export const Sidebar: Component = () => {
  const [state, actions] = useAppStore();

  return (
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-logo">w</div>
        <span class="brand-name">wapp</span>
      </div>

      <button class="sidebar-add-btn" onClick={() => actions.setShowAddModal(true)}>
        <Plus size={18} />
        New Wapp
      </button>

      <nav class="nav-group">
        <button 
          class="nav-item" 
          classList={{ active: state.activeTab === "all" }}
          onClick={() => actions.setActiveTab("all")}
        >
          <Folder size={16} />
          All Wapps
        </button>
        <button 
          class="nav-item" 
          classList={{ active: state.activeTab === "settings" }}
          onClick={() => actions.setActiveTab("settings")}
        >
          <Settings size={16} />
          Setup Guide
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="status-badge" onClick={() => actions.checkDeps()} style="cursor: pointer;">
          <div 
            class="status-dot" 
            classList={{ 
              active: !!state.depStatus?.node_installed && !!state.depStatus?.rust_installed, 
              inactive: !state.depStatus?.node_installed || !state.depStatus?.rust_installed 
            }} 
          />
          <span>
            {state.isCheckingDeps 
              ? "Checking..." 
              : state.depStatus?.node_installed && state.depStatus?.rust_installed 
                ? "System Ready" 
                : "Setup Required"
            }
          </span>
        </div>
      </div>
    </aside>
  );
};
