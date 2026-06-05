import { Component, For, Show } from "solid-js";
import { FolderOpen } from "lucide-solid";
import { WappCard, LoadingCard } from "./WappCard";
import { WappConfig, ActiveBuild } from "../types";

interface WappGridProps {
  wapps: WappConfig[];
  activeBuilds: ActiveBuild[];
  filterCategory: string;
  setFilterCategory: (cat: string) => void;
  onLaunch: (path: string) => void;
  onDelete: (id: string) => void;
  onCancelBuild: (id: string) => void;
  onOpenFolder: () => void;
  onAddClick: () => void;
}

export const WappGrid: Component<WappGridProps> = (props) => {
  return (
    <>
      <div class="workspace-header">
        <div class="workspace-filters">
          <For each={["All", "Work", "Enterprise"]}>
            {(cat) => (
              <button 
                class="filter-btn" 
                classList={{ active: props.filterCategory === cat }}
                onClick={() => props.setFilterCategory(cat)}
              >
                {cat}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="wapp-grid">
        {/* Show Active Builds first */}
        <For each={props.activeBuilds}>
          {(build) => (
            <LoadingCard 
              name={build.name}
              category={build.category}
              status={build.state === "error" ? "Build failed" : "Building..."}
              log={build.logs[0] || ""}
              onCancel={() => props.onCancelBuild(build.id)}
            />
          )}
        </For>

        {/* Show Installed Wapps */}
        <For each={props.wapps}>
          {(wapp) => (
            <WappCard 
              wapp={wapp}
              onLaunch={props.onLaunch}
              onDelete={props.onDelete}
            />
          )}
        </For>

        {/* Empty State */}
        <Show when={props.wapps.length === 0 && props.activeBuilds.length === 0}>
          <div class="empty-state">
            <div class="empty-title">Your workspace is empty</div>
            <div class="empty-desc">Convert your first website into a desktop app to see it here.</div>
            <button class="btn-primary" onClick={props.onAddClick} style="margin-top: 0.5rem; font-size: 0.8rem;">
              Create your first wapp
            </button>
          </div>
        </Show>
      </div>
    </>
  );
};
