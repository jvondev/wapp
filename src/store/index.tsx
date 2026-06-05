import { createStore, produce } from "solid-js/store";
import { createContext, useContext, JSX, onMount } from "solid-js";
import { WappConfig, DependencyStatus, ActiveBuild, BuildProgressEvent, InstallProgressEvent } from "../types";
import { tauriService } from "../services/tauri";
import { listen } from "@tauri-apps/api/event";

interface AppState {
  wapps: WappConfig[];
  activeBuilds: Record<string, ActiveBuild>;
  depStatus: DependencyStatus | null;
  isCheckingDeps: boolean;
  installLogs: string[];
  installState: "idle" | "running" | "done" | "error";
  activeTab: "all" | "settings";
  filterCategory: string;
  showAddModal: boolean;
}

const initialState: AppState = {
  wapps: [],
  activeBuilds: {},
  depStatus: null,
  isCheckingDeps: false,
  installLogs: [],
  installState: "idle",
  activeTab: "all",
  filterCategory: "All",
  showAddModal: false,
};

function createAppStore() {
  const [state, setState] = createStore<AppState>(initialState);

  // Actions
  const actions = {
    setActiveTab: (tab: "all" | "settings") => setState("activeTab", tab),
    setFilterCategory: (cat: string) => setState("filterCategory", cat),
    setShowAddModal: (show: boolean) => setState("showAddModal", show),
    
    checkDeps: async () => {
      setState("isCheckingDeps", true);
      try {
        const res = await tauriService.checkDependencies();
        setState("depStatus", res);
      } finally {
        setState("isCheckingDeps", false);
      }
    },

    loadWapps: async () => {
      const loaded = await tauriService.loadWapps();
      setState("wapps", loaded);
    },

    deleteWapp: async (id: string) => {
      setState("wapps", prev => prev.filter(w => w.id !== id));
      await tauriService.saveWapps([...state.wapps]);
    },

    cancelBuild: (id: string) => {
      setState("activeBuilds", produce(prev => { delete prev[id]; }));
    },

    startBuild: async (data: any, favicon: string) => {
      const uniqueId = Math.random().toString(36).substring(2, 9);
      setState("activeBuilds", uniqueId, {
        id: uniqueId,
        name: data.name,
        url: data.url,
        logs: [`Initializing build for ${data.name}...`],
        state: "building",
        category: data.category
      });

      setState({ showAddModal: false, activeTab: "all" });

      try {
        await tauriService.buildWapp({
          ...data,
          id: uniqueId,
          icon: favicon || null,
          hide_title_bar: data.hideTitle,
          created_at: new Date().toLocaleDateString()
        });
      } catch (err) {
        setState("activeBuilds", uniqueId, produce(b => {
          b.logs = [`Error: ${err}`, ...b.logs];
          b.state = "error";
        }));
      }
    },

    installDeps: async () => {
      if (state.installState === "running") return;
      setState({ installLogs: ["Starting automatic setup..."], installState: "running" });
      try {
        await tauriService.installDependencies();
      } catch (err) {
        setState({ installLogs: [`Error: ${err}`, ...state.installLogs], installState: "error" });
      }
    }
  };

  // Listeners
  onMount(() => {
    listen<BuildProgressEvent>("build-progress", (event) => {
      const { app_id, message, status } = event.payload;
      if (!state.activeBuilds[app_id]) return;

      const newState = status === "running" ? "building" : 
                       status === "success" ? "success" : "error";
      
      setState("activeBuilds", app_id, produce(b => {
        b.logs = [message, ...b.logs].slice(0, 100);
        b.state = newState;
      }));

      if (newState === "success") {
        actions.loadWapps();
        setTimeout(() => actions.cancelBuild(app_id), 3000);
      }
    });

    listen<InstallProgressEvent>("install-progress", (event) => {
      const { message, status } = event.payload;
      setState("installLogs", prev => [message, ...prev]);
      if (status === "done") {
        setState("installState", "done");
        actions.checkDeps();
      } else if (status === "error") {
        setState("installState", "error");
      }
    });
  });

  return [state, actions] as const;
}

const AppStoreContext = createContext<ReturnType<typeof createAppStore>>();

export function AppStoreProvider(props: { children: JSX.Element }) {
  const store = createAppStore();
  return (
    <AppStoreContext.Provider value={store}>
      {props.children}
    </AppStoreContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(AppStoreContext);
  if (!context) throw new Error("useAppStore must be used within AppStoreProvider");
  return context;
}
