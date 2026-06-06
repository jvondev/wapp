import { Component, For, Show } from "solid-js";
import { WappCard, LoadingCard } from "./WappCard";
import { useAppStore } from "../store";
import { tauriService } from "../services/tauri";

export const WappGrid: Component = () => {
  const [state, actions] = useAppStore();

  const filteredWapps = () => {
    if (state.filterCategory === "All") return state.wapps;
    return state.wapps.filter(w => w.category === state.filterCategory);
  };

  const filteredBuilds = () => {
    const builds = Object.values(state.activeBuilds);
    if (state.filterCategory === "All") return builds;
    return builds.filter(b => b.category === state.filterCategory);
  };

  return (
    <>
      <div class="workspace-header">
        <div class="workspace-filters">
          <For each={["All", "Work", "Enterprise"]}>
            {(cat) => (
              <button 
                class="filter-btn" 
                classList={{ active: state.filterCategory === cat }}
                onClick={() => actions.setFilterCategory(cat)}
              >
                {cat}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="wapp-grid">
        <For each={filteredBuilds()}>
          {(build) => (
            <LoadingCard 
              name={build.name}
              category={build.category}
              status={build.state === "error" ? "Build failed" : "Building..."}
              log={build.logs[0] || ""}
              onCancel={() => actions.cancelBuild(build.id)}
            />
          )}
        </For>

        <For each={filteredWapps()}>
          {(wapp) => (
            <WappCard 
              wapp={wapp}
              onLaunch={(path) => tauriService.launchWapp(path)}
              onDelete={(id) => actions.deleteWapp(id)}
              onEdit={(wapp) => actions.setEditingWapp(wapp)}
            />
          )}
        </For>

        <Show when={state.wapps.length === 0 && Object.keys(state.activeBuilds).length === 0}>
          <div class="empty-state premium-empty fade-in" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 4rem 2rem; background: transparent; border: 1px dashed rgba(255,255,255,0.08); border-radius: 8px; margin-top: 1rem;">
            <div class="empty-illustration" style="margin-bottom: 1.5rem; display: flex; justify-content: center; align-items: center; width: 64px; height: 64px; border-radius: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </div>
            
            <h3 style="font-size: 1rem; font-weight: 500; color: #e4e4e7; margin-bottom: 0.5rem;">No Applications Yet</h3>
            <p style="color: #71717a; text-align: center; max-width: 320px; font-size: 0.85rem; line-height: 1.5; margin-bottom: 1.5rem;">Create a high-performance desktop app from any URL. It only takes a few seconds.</p>
            
            <button class="btn-command" onClick={() => actions.setShowAddModal(true)} style="padding: 0.6rem 1.2rem; font-size: 0.85rem; font-weight: 500; border-radius: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 0.5rem;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Create New Wapp
            </button>
          </div>
        </Show>
      </div>
    </>
  );
};
