import { Component } from "solid-js";
import { LayoutGrid, Plus, Sparkles } from "lucide-solid";
import { useAppStore } from "../store";

export const Sidebar: Component = () => {
  const [state, actions] = useAppStore();

  return (
    <aside class="sidebar">
      <div class="brand" style="margin-bottom: 2.5rem; padding: 0 0.5rem;">
        <div class="brand-logo" style="width: 28px; height: 28px; border-radius: 8px; background: hsl(var(--foreground)); color: hsl(var(--background)); font-size: 1rem;">w</div>
        <span class="brand-name" style="font-size: 1.1rem; font-weight: 700; letter-spacing: -0.02em;">wapp</span>
      </div>

      <button class="sidebar-add-btn"
        style="margin-bottom: 2rem; height: 42px; border-radius: 12px; background: hsl(var(--primary)); box-shadow: var(--shadow-md); transition: transform 0.2s, box-shadow 0.2s; border: none; color: hsl(var(--primary-foreground)); width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; cursor: pointer;"
        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        onClick={() => actions.setShowAddModal(true)}
      >
        <Plus size={18} />
        <span style="font-weight: 600;">New Wapp</span>
      </button>

      <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: hsl(var(--muted-foreground)); letter-spacing: 0.05em; margin-bottom: 0.75rem; padding-left: 0.75rem;">Library</div>

      <nav class="nav-group" style="gap: 0.25rem; display: flex; flex-direction: column;">
        <button 
          class="nav-item" 
          classList={{ active: state.activeTab === "all" }}
          onClick={() => actions.setActiveTab("all")}
          style="padding: 0.625rem 0.875rem; border-radius: 10px; display: flex; align-items: center; gap: 0.75rem; transition: all 0.2s; border: none; background: transparent; cursor: pointer; color: hsl(var(--muted-foreground)); font-size: 0.85rem; font-weight: 500;"
        >
          <LayoutGrid size={18} />
          <span>All Apps</span>
        </button>
        <button 
          class="nav-item" 
          classList={{ active: state.activeTab === "settings" }}
          onClick={() => actions.setActiveTab("settings")}
          style="padding: 0.625rem 0.875rem; border-radius: 10px; display: flex; align-items: center; gap: 0.75rem; transition: all 0.2s; border: none; background: transparent; cursor: pointer; color: hsl(var(--muted-foreground)); font-size: 0.85rem; font-weight: 500;"
        >
          <Sparkles size={18} />
          <span>Setup Guide</span>
        </button>
      </nav>

      <div style="margin-top: auto; padding: 0.5rem;">
        <div style="padding: 1rem; background: hsl(var(--muted) / 0.5); border-radius: 12px; border: 1px solid hsl(var(--border));">
           <p style="font-size: 0.7rem; font-weight: 600; color: hsl(var(--foreground)); margin-bottom: 0.25rem;">Pro Tip</p>
           <p style="font-size: 0.65rem; color: hsl(var(--muted-foreground)); line-height: 1.4;">Press <kbd style="background: hsl(var(--background)); border: 1px solid hsl(var(--border)); padding: 0 0.2rem; border-radius: 3px; font-family: inherit;">⌘ K</kbd> to quickly create a new wapp.</p>
        </div>
      </div>
    </aside>
  );
};
