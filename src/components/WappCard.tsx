import { Component, Show } from "solid-js";
import { Play, Trash2, Loader2 } from "lucide-solid";
import { WappConfig } from "../types";

interface WappCardProps {
  wapp: WappConfig;
  onLaunch: (path: string) => void;
  onDelete: (id: string) => void;
  onEdit: (wapp: WappConfig) => void;
}

export const WappCard: Component<WappCardProps> = (props) => {
  return (
    <div class="wapp-card">
      <div class="wapp-card-header">
        <div class="wapp-icon">
          <Show when={props.wapp.icon} fallback={props.wapp.name.charAt(0)}>
            <img src={props.wapp.icon!} style="width: 100%; height: 100%; border-radius: 4px; object-fit: contain;" />
          </Show>
        </div>
        <div class="wapp-info">
          <span class="wapp-name">{props.wapp.name}</span>
          <span class="wapp-url">{props.wapp.url.replace("https://", "").replace("http://", "")}</span>
        </div>
      </div>
      <div class="wapp-card-body">
        <span class={`wapp-badge ${props.wapp.category.toLowerCase()}`}>{props.wapp.category}</span>
      </div>
      <div class="wapp-card-footer">
        <span class="wapp-date">{props.wapp.created_at}</span>
        <div class="wapp-actions">
          <button class="btn-icon" onClick={() => props.onLaunch(props.wapp.path)} title="Launch App">
            <Play size={12} />
          </button>
          <button class="btn-icon" onClick={() => props.onEdit(props.wapp)} title="Edit App">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="btn-icon delete" onClick={() => props.onDelete(props.wapp.id)} title="Delete App">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
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
    <div class="wapp-card loading">
      <div class="wapp-card-header">
        <div class="wapp-icon">
          <Loader2 size={16} class="loading-spinner" />
        </div>
        <div class="wapp-info">
          <span class="wapp-name">{props.name}</span>
          <span class="wapp-url">{props.status}</span>
        </div>
      </div>
      <div class="wapp-card-body">
         <span class="wapp-badge all">{props.category}</span>
      </div>
      <div class="wapp-card-footer">
         <span class="wapp-date" style="color: #666; font-size: 0.6rem;">
            {props.log?.substring(0, 30)}...
         </span>
         <Show when={props.status === "Build failed"}>
            <button class="btn-icon delete" onClick={props.onCancel}>
              <Trash2 size={12} />
            </button>
         </Show>
      </div>
    </div>
  );
};
