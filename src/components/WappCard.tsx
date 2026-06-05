import { Component, Show } from "solid-js";
import { Play, Trash2, Loader2 } from "lucide-solid";
import { WappConfig } from "../types";

interface WappCardProps {
  wapp: WappConfig;
  onLaunch: (path: string) => void;
  onDelete: (id: string) => void;
}

export const WappCard: Component<WappCardProps> = (props) => {
  return (
    <div class="wapp-card">
      <div class="wapp-card-header">
        <div class="wapp-icon">
          {props.wapp.name.charAt(0)}
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
          <button class="btn-icon" onClick={() => props.onLaunch(props.wapp.path)}>
            <Play size={12} />
          </button>
          <button class="btn-icon delete" onClick={() => props.onDelete(props.wapp.id)}>
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
