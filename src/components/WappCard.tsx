import { Component, Show, createSignal } from "solid-js";
import { Play, MoreHorizontal, Loader2, Edit2, Trash2, ExternalLink } from "lucide-solid";
import { WappConfig } from "../types";
import { ContextMenu } from "./ContextMenu";

export const SkeletonCard: Component = () => (
  <div class="wapp-card skeleton" style="aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; border: none; background: transparent; box-shadow: none;">
    <div class="skeleton-shimmer" style="width: 80px; height: 80px; border-radius: 20px;" />
    <div class="skeleton-shimmer" style="height: 12px; width: 60px; border-radius: 4px;" />
  </div>
);

const WappTileIcon: Component<{ icon?: string; name: string }> = (props) => (
  <div class="wapp-icon-container">
    <Show when={props.icon} fallback={<div class="wapp-icon-fallback">{props.name.charAt(0)}</div>}>
      <img src={props.icon!} class="wapp-icon-img" />
    </Show>
    <div class="wapp-tile-overlay">
      <Play size={24} fill="currentColor" />
    </div>
  </div>
);

const WappTileInfo: Component<{ name: string; category: string }> = (props) => (
  <div class="wapp-tile-info">
    <span class="wapp-tile-name">{props.name}</span>
    <span class="wapp-tile-category">{props.category}</span>
  </div>
);

interface WappCardProps {
  wapp: WappConfig;
  onLaunch: (path: string) => void;
  onDelete: (id: string) => void;
  onEdit: (wapp: WappConfig) => void;
}

export const WappCard: Component<WappCardProps> = (props) => {
  const [contextMenu, setContextMenu] = createSignal<{ x: number, y: number } | null>(null);

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const menuOptions = [
    { label: "Launch App", icon: Play, onClick: () => props.onLaunch(props.wapp.path) },
    { label: "Edit Config", icon: Edit2, onClick: () => props.onEdit(props.wapp) },
    { label: "View Source", icon: ExternalLink, onClick: () => window.open(props.wapp.url, '_blank') },
    { label: "Delete Wapp", icon: Trash2, onClick: () => props.onDelete(props.wapp.id), variant: "danger" as const },
  ];

  return (
    <>
      <div
        class="wapp-card-os"
        onClick={() => props.onLaunch(props.wapp.path)}
        onContextMenu={handleContextMenu}
      >
        <div class="wapp-tile">
          <WappTileIcon icon={props.wapp.icon} name={props.wapp.name} />
          <WappTileInfo name={props.wapp.name} category={props.wapp.category} />
        </div>
        <button
          class="wapp-tile-more"
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setContextMenu({ x: rect.left, y: rect.bottom + 5 });
          }}
        >
          <MoreHorizontal />
        </button>
        {contextMenu() && (
          <ContextMenu x={contextMenu()?.x} y={contextMenu()?.y} options={menuOptions} onClose={() => setContextMenu(null)} />
        )}
      </div>
    </>
  );
}
        <button
          class="wapp-tile-more"
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setContextMenu({ x: rect.left, y: rect.bottom + 5 });
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      <Show when={contextMenu()}>
        {(pos) => (
          <ContextMenu
            x={pos().x}
            y={pos().y}
            options={menuOptions}
            onClose={() => setContextMenu(null)}
          />
        )}
      </Show>
    </>
  );
};

interface LoadingCardProps {
  name: string;
  category: string;
  status: string;
  log: string;
  onCancel?: () => void;
}

export const LoadingCard: Component<LoadingCardProps> = (props) => {
  return (
    <div class="wapp-card-os loading">
      <div class="wapp-tile">
        <div class="wapp-icon-container loading">
          <Loader2 size={32} class="loading-spinner" />
          <div class="loading-progress-ring" />
        </div>
        <div class="wapp-tile-info">
          <span class="wapp-tile-name">{props.name}</span>
          <span class="wapp-tile-status">{props.status}</span>
        </div>
      </div>
    </div>
  );
};
