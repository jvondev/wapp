import { Component, For, Show } from "solid-js";
import { CheckCircle2, Loader2 } from "lucide-solid";
import { DependencyStatus } from "../types";

interface SettingsViewProps {
  depStatus: DependencyStatus | null;
  installState: "idle" | "running" | "done" | "error";
  installLogs: string[];
  onInstall: () => void;
}

export const SettingsView: Component<SettingsViewProps> = (props) => {
  return (
    <div class="settings-container">
      <div class="settings-card">
        <h3>Environment status</h3>
        <p>We need Node.js and Rust to package your applications. If missing, use the auto-setup below.</p>
        
        <div class="dep-list">
          <div class="dep-item">
            <div class="dep-info">
              <span class="dep-title">Node.js Runtime</span>
              <span class="dep-desc">Required for packaging scripts</span>
            </div>
            <div class="dep-status">
              <Show when={props.depStatus?.node_installed} fallback={<span class="dep-badge missing">Missing</span>}>
                <span class="dep-badge ok">{props.depStatus?.node_version}</span>
                <CheckCircle2 size={14} color="#10b981" />
              </Show>
            </div>
          </div>
          
          <div class="dep-item">
            <div class="dep-info">
              <span class="dep-title">Rust Compiler</span>
              <span class="dep-desc">Required for native compilation</span>
            </div>
            <div class="dep-status">
              <Show when={props.depStatus?.rust_installed} fallback={<span class="dep-badge missing">Missing</span>}>
                <span class="dep-badge ok">Installed</span>
                <CheckCircle2 size={14} color="#10b981" />
              </Show>
            </div>
          </div>
        </div>
      </div>

      <Show when={!props.depStatus?.node_installed || !props.depStatus?.rust_installed}>
        <div class="settings-card" style="border-color: rgba(59, 130, 246, 0.3); background-color: rgba(59, 130, 246, 0.02);">
          <h3>Automatic Setup</h3>
          <p>Click below to download and install all missing dependencies automatically.</p>
          
          <button 
            class="btn-primary" 
            style="margin-top: 1rem; width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem;"
            onClick={props.onInstall}
            disabled={props.installState === "running"}
          >
            {props.installState === "running" ? <Loader2 size={16} class="loading-spinner" /> : "Install Dependencies"}
          </button>

          <Show when={props.installState !== "idle"}>
            <div style="margin-top: 1rem; background: #000; border: 1px solid #333; border-radius: 4px; padding: 0.75rem; max-height: 150px; overflow-y: auto; font-family: monospace; font-size: 0.7rem;">
              <For each={props.installLogs}>
                {(log) => <div style="margin-bottom: 2px;">{log}</div>}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      <div class="settings-card">
        <h3>About wapp</h3>
        <p>v0.1.0 Alpha — Built with Tauri, Pake, and SolidJS.</p>
      </div>
    </div>
  );
};
