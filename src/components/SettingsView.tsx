import { Component } from "solid-js";
import { useAppStore } from "../store";
import { tauriService } from "../services/tauri";

export const SettingsView: Component = () => {
  const [state, actions] = useAppStore();

  return (
    <div class="settings-container">
      <div class="settings-card">
        <h3>Appearance</h3>
        <p>Choose your preferred theme for the interface.</p>
        <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
          <button 
            class={`pill-btn ${state.theme === 'light' ? 'active' : ''}`}
            onClick={() => actions.setTheme('light')}
          >
            Light
          </button>
          <button 
            class={`pill-btn ${state.theme === 'dark' ? 'active' : ''}`}
            onClick={() => actions.setTheme('dark')}
          >
            Dark
          </button>
        </div>
      </div>

      <div class="settings-card">
        <h3>Workspace</h3>
        <p>Your generated apps are stored in the Wapp workspace folder on your system.</p>
        <button
          class="btn-command"
          style="margin-top: 1rem; font-size: 0.85rem; padding: 0.6rem 1.2rem; width: auto;"
          onClick={() => tauriService.openWorkspaceFolder()}
        >
          Open Workspace Folder
        </button>
      </div>

      <div class="settings-card">
        <h3>Library</h3>
        <p>{state.wapps.length} application{state.wapps.length !== 1 ? "s" : ""} in your library.</p>
      </div>

      <div class="settings-card">
        <h3>About Wapp</h3>
        <p style="color: #71717a; font-size: 0.85rem; line-height: 1.6;">
          v0.1.0 — Built with Tauri v2 and SolidJS.<br />
          Engine: <code style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">@jvondev/wapp-base</code><br />
          License: Apache-2.0
        </p>
      </div>
    </div>
  );
};
