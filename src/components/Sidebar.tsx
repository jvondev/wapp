import { Component } from "solid-js";
import { LayoutGrid, Plus, Sparkles } from "lucide-solid";
import { useAppStore } from "../store";

export const SidebarLogo: Component = () => (
  <div class="sidebar-logo-container">
    <div class="sidebar-logo">w</div>
    <span class="sidebar-brand-name">wapp</span>
  </div>
);

interface SidebarNavProps {
  state: any;
  actions: any;
}

export const SidebarNav: Component<SidebarNavProps> = (props) => (
  <nav class="nav-group">
    <button
      class="nav-item"
      classList={{ active: props.state.activeTab === "all" }}
      onClick={() => props.actions.setActiveTab("all")}
    >
      <LayoutGrid size={18} />
      <span>All Apps</span>
    </button>
    <button
      class="nav-item"
      classList={{ active: props.state.activeTab === "settings" }}
      onClick={() => props.actions.setActiveTab("settings")}
    >
      <Sparkles size={18} />
      <span>Setup Guide</span>
    </button>
  </nav>
);

export const ProTipBox: Component = () => (
  <div class="sidebar-footer">
    <div class="pro-tip-box">
      <p class="pro-tip-title">Pro Tip</p>
      <p class="pro-tip-text">
        Press <kbd class="kbd-hint">⌘ K</kbd> to quickly create a new wapp.
      </p>
    </div>
  </div>
);

export const Sidebar: Component = () => {
  const [state, actions] = useAppStore();

  return (
    <aside class="sidebar">
      <SidebarLogo />

      <button
        class="sidebar-btn-primary"
        onClick={() => actions.setShowAddModal(true)}
      >
        <Plus size={18} />
        <span>New Wapp</span>
      </button>

      <div class="sidebar-label">Library</div>

      <SidebarNav state={state} actions={actions} />

      <ProTipBox />
    </aside>
  );
};
