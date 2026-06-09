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

      <div class="wapp-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 2rem; padding: 1rem 0;">
        {/* Skeleton shimmer while fetching */}
        <Show when={state.isLoading}>
          <For each={Array(6).fill(null)}>
            {(_, i) => (
              <div class="stagger-item" style={`animation-delay: ${i() * 0.05}s`}>
                <SkeletonCard />
              </div>
            )}
          </For>
        </Show>

        <Show when={!state.isLoading}>
          <For each={filteredBuilds()}>
            {(build, i) => (
              <div class="stagger-item" style={`animation-delay: ${i() * 0.05}s`}>
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
              <div class="stagger-item" style={`animation-delay: ${(filteredBuilds().length + i()) * 0.05}s`}>
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
            <div class="empty-state fade-in" style="grid-column: 1 / -1; border: 2px dashed hsl(var(--border)); background: transparent; border-radius: 24px; padding: 5rem 2rem;">
              <div style="margin-bottom: 1.5rem; display: flex; justify-content: center; align-items: center; width: 64px; height: 64px; border-radius: 20px; background: hsl(var(--muted) / 0.5); border: 1px solid hsl(var(--border));">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: hsl(var(--muted-foreground));">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
              </div>
              <h3 class="empty-title" style="font-size: 1.1rem; margin-bottom: 0.5rem;">Ready to build something?</h3>
              <p style="color: hsl(var(--muted-foreground)); text-align: center; max-width: 320px; font-size: 0.85rem; line-height: 1.6; margin-bottom: 2rem;">
                Turn any web experience into a first-class desktop application. Just paste a URL to begin.
              </p>
              <button class="btn-primary" onClick={() => actions.setShowAddModal(true)} style="height: 42px; padding: 0 1.5rem; border-radius: 12px; font-weight: 600;">
                + Create Your First Wapp
              </button>
            </div>
          </Show>
        </Show>
      </div>
    </>
  );
};
