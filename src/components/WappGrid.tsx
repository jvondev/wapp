import { Component, For, Show } from "solid-js";
import { WappCard, LoadingCard, SkeletonCard } from "./WappCard";
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
        {/* Skeleton shimmer while fetching */}
        <Show when={state.isLoading}>
          <For each={Array(6).fill(null)}>
            {(_, i) => (
              <div style={`animation-delay: ${i() * 0.06}s`}>
                <SkeletonCard />
              </div>
            )}
          </For>
        </Show>

        <Show when={!state.isLoading}>
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
            {(wapp, i) => (
              <div style={`animation-delay: ${i() * 0.05}s`}>
                <WappCard
                  wapp={wapp}
                  onLaunch={(path) => tauriService.launchWapp(path)}
                  onDelete={(id) => actions.deleteWapp(id)}
                  onEdit={(wapp) => actions.setEditingWapp(wapp)}
                />
              </div>
            )}
          </For>

          <Show when={state.wapps.length === 0 && Object.keys(state.activeBuilds).length === 0}>
            <div class="empty-state fade-in" style="grid-column: 1 / -1;">
              <div style="margin-bottom: 1.25rem; display: flex; justify-content: center; align-items: center; width: 56px; height: 56px; border-radius: 14px; background: hsl(var(--muted)); border: 1px solid hsl(var(--border));">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: hsl(var(--muted-foreground));">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
              </div>
              <h3 class="empty-title">No Applications Yet</h3>
              <p style="color: hsl(var(--muted-foreground)); text-align: center; max-width: 280px; font-size: 0.8rem; line-height: 1.6; margin-bottom: 1rem;">
                Create a high-performance desktop app from any URL. It only takes a few seconds.
              </p>
              <button class="btn-primary" onClick={() => actions.setShowAddModal(true)}>
                + Create New Wapp
              </button>
            </div>
          </Show>
        </Show>
      </div>
    </>
  );
};
