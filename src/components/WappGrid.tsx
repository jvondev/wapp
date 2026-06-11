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
      <Show when={state.wapps.length > 0 || Object.keys(state.activeBuilds).length > 0 || state.isLoading}>
        <div class="workspace-header stagger-item" style="animation-delay: 0.05s">
          <div class="workspace-filters" style="background: hsl(var(--muted) / 0.5); padding: 0.25rem; border-radius: 10px; border: 1px solid hsl(var(--border));">
            <For each={["All", "Work", "Enterprise"]}>
              {(cat) => (
                <button
                  class="filter-btn"
                  classList={{ active: state.filterCategory === cat }}
                  onClick={() => actions.setFilterCategory(cat)}
                  style="padding: 0.4rem 1rem; border-radius: 7px; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);"
                >
                  {cat}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      <div class="wapp-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1.5rem; padding: 1rem 0;">
        {/* Skeleton shimmer while fetching */}
        <Show when={state.isLoading}>
          <For each={Array(6).fill(null)}>
            {(_, i) => (
              <div class="stagger-item" style={`animation-delay: ${0.1 + i() * 0.08}s`}>
                <SkeletonCard />
              </div>
            )}
          </For>
        </Show>

        <Show when={!state.isLoading}>
          <For each={filteredBuilds()}>
            {(build, i) => (
              <div class="stagger-item" style={`animation-delay: ${0.1 + i() * 0.08}s`}>
                <LoadingCard
                  name={build.name}
                  category={build.category}
                  status={build.state === "error" ? "Build failed" : "Building..."}
                  log={build.logs[0] || ""}
                  onCancel={() => actions.cancelBuild(build.id)}
                />
              </div>
            )}
          </For>

          <For each={filteredWapps()}>
            {(wapp, i) => (
              <div class="stagger-item" style={`animation-delay: ${0.1 + (filteredBuilds().length + i()) * 0.08}s`}>
                <WappCard
                  wapp={wapp}
                  onLaunch={(path) => tauriService.launchWapp(path)}
                  onDelete={(id) => actions.deleteWapp(id)}
                  onEdit={(wapp) => actions.setEditingWapp(wapp)}
                />
              </div>
            )}
          </For>
        </Show>
      </div>

      <Show when={!state.isLoading && state.wapps.length === 0 && Object.keys(state.activeBuilds).length === 0}>
        <div class="empty-state-container">
          <div class="empty-state-os">
            <div class="empty-state-icon stagger-item" style="animation-delay: 0.15s">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </div>
            <h3 class="empty-state-title stagger-item" style="animation-delay: 0.25s">Ready to build something?</h3>
            <p class="empty-state-description stagger-item" style="animation-delay: 0.35s">
              Turn any web experience into a first-class desktop application. Just paste a URL to begin.
            </p>
            <div class="stagger-item" style="animation-delay: 0.45s">
                <button
                class="btn-primary"
                onClick={() => actions.setShowAddModal(true)}
                style="height: 48px; padding: 0 2rem; border-radius: 14px; font-weight: 600; font-size: 1rem;"
                >
                + Create Your First Wapp
                </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
};
