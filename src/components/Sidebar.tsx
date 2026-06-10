import { Component } from "solid-js";
import { LayoutGrid, Plus, Sparkles } from "lucide-solid";
import { useAppStore } from "../store";

export const Sidebar: Component = () => {
  const [state, actions] = useAppStore();

  return (
    <aside class="sidebar">
      <div class="sidebar-logo-container">
        <div class="sidebar-logo">w</div>
        <span class="sidebar-brand-name">wapp</span>
      </div>

      <button
        class="sidebar-btn-primary"
        onClick={() => actions.setShowAddModal(true)}
      >
        <Plus size={18} />
        <span>New Wapp</span>
      </button>

      <div class="sidebar-label">Library</div>

      <nav class="nav-group">
        <button 
          class="nav-item" 
          classList={{ active: state.activeTab === "all" }}
          onClick={() => actions.setActiveTab("all")}
        >
          <LayoutGrid size={18} />
          <span>All Apps</span>
        </button>
        <button 
          class="nav-item" 
          classList={{ active: state.activeTab === "settings" }}
          onClick={() => actions.setActiveTab("settings")}
        >
          <Sparkles size={18} />
          <span>Setup Guide</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="pro-tip-box">
           <p class="pro-tip-title">Pro Tip</p>
           <p class="pro-tip-text">Press <kbd class="kbd-hint">⌘ K</kbd> to quickly create a new wapp.</p>
        </div>
      </div>
    </aside>
  );
};
