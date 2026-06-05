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
            />
          )}
        </For>

        <Show when={state.wapps.length === 0 && Object.keys(state.activeBuilds).length === 0}>
          <div class="empty-state">
            <div class="empty-title">Your workspace is empty</div>
            <div class="empty-desc">Convert your first website into a desktop app to see it here.</div>
            <button class="btn-primary" onClick={() => actions.setShowAddModal(true)} style="margin-top: 0.5rem; font-size: 0.8rem;">
              Create your first wapp
            </button>
          </div>
        </Show>
      </div>
    </>
  );
};
