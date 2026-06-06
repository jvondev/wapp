import { onMount, Show } from "solid-js";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import { FolderOpen } from "lucide-solid";

// Store & Modules
import { useAppStore } from "./store";
import { tauriService } from "./services/tauri";
import { Sidebar } from "./components/Sidebar";
import { WappGrid } from "./components/WappGrid";
import { SettingsView } from "./components/SettingsView";
import { CommandCenter } from "./components/CommandCenter";
import { EditWappModal } from "./components/EditWappModal";
import { Notifications } from "./components/Notifications";

function App() {
  const [state, actions] = useAppStore();

  onMount(() => {
    actions.loadWapps();
  });

  return (
    <>
      <Sidebar />

      <main class="main-panel">
        <header class="header">
          <h2 class="header-title">
            {state.activeTab === "all" ? "All Wapps" : "Environment setup"}
          </h2>
          <Show when={state.activeTab === "all"}>
            <button class="filter-btn border-btn" onClick={() => tauriService.openWorkspaceFolder()}>
              <FolderOpen size={12} />
              Open Folder
            </button>
          </Show>
        </header>

        <div class="content">
          <div class="tab-view">
            <Show when={state.activeTab === "all"}>
              <WappGrid />
            </Show>

            <Show when={state.activeTab === "settings"}>
              <SettingsView />
            </Show>
          </div>
        </div>
      </main>

      <CommandCenter />
      <EditWappModal />
      <Notifications />
    </>
  );
}

export default App;
