import { createStore, produce } from "solid-js/store";
import { createContext, useContext, JSX, onMount, onCleanup } from "solid-js";
import { WappConfig, DependencyStatus, ActiveBuild, BuildProgressEvent, InstallProgressEvent } from "../types";
import { tauriService } from "../services/tauri";
import { listen } from "@tauri-apps/api/event";

export interface Notification {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  timestamp: number;
}

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
  notifications: Notification[];
}

const STORAGE_KEY = "wapp_prefs";

const initialState: AppState = {
  wapps: [],
  activeBuilds: {},
  depStatus: null,
  isCheckingDeps: false,
  installLogs: [],
  installState: "idle",
  activeTab: (localStorage.getItem(`${STORAGE_KEY}_tab`) as any) || "all",
  filterCategory: localStorage.getItem(`${STORAGE_KEY}_cat`) || "All",
  showAddModal: false,
  notifications: [],
};

function createAppStore() {
  const [state, setState] = createStore<AppState>(initialState);

  // Actions
  const actions = {
    setActiveTab: (tab: "all" | "settings") => {
      setState("activeTab", tab);
      localStorage.setItem(`${STORAGE_KEY}_tab`, tab);
    },
    setFilterCategory: (cat: string) => {
      setState("filterCategory", cat);
      localStorage.setItem(`${STORAGE_KEY}_cat`, cat);
    },
    setShowAddModal: (show: boolean) => setState("showAddModal", show),
    
    addNotification: (message: string, type: "success" | "error" | "info" = "info") => {
      const id = Math.random().toString(36).substring(7);
      setState("notifications", prev => [{ id, message, type, timestamp: Date.now() }, ...prev]);
      setTimeout(() => actions.removeNotification(id), 5000);
    },

    removeNotification: (id: string) => {
      setState("notifications", prev => prev.filter(n => n.id !== id));
    },

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
      const updated = state.wapps.filter(w => w.id !== id);
      setState("wapps", updated);
      await tauriService.saveWapps(updated);
      actions.addNotification("Application removed", "info");
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
      actions.addNotification(`Building ${data.name}...`, "info");

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
        actions.addNotification(`Build failed: ${err}`, "error");
      }
    },

    installDeps: async () => {
      if (state.installState === "running") return;
      setState({ installLogs: ["Starting automatic setup..."], installState: "running" });
      try {
        await tauriService.installDependencies();
      } catch (err) {
        setState({ installLogs: [`Error: ${err}`, ...state.installLogs], installState: "error" });
        actions.addNotification("Installation failed", "error");
      }
    }
  };

  // Listeners
  onMount(() => {
    // Global Keyboard Shortcut (Ctrl+K or Cmd+K)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        actions.setShowAddModal(!state.showAddModal);
      }
      if (e.key === "Escape" && state.showAddModal) {
        actions.setShowAddModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const buildUnlisten = listen<BuildProgressEvent>("build-progress", (event) => {
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
        actions.addNotification(`${state.activeBuilds[app_id].name} is ready!`, "success");
        setTimeout(() => actions.cancelBuild(app_id), 3000);
      } else if (newState === "error") {
        actions.addNotification(`Build failed for ${state.activeBuilds[app_id].name}`, "error");
      }
    });

    const installUnlisten = listen<InstallProgressEvent>("install-progress", (event) => {
      const { message, status } = event.payload;
      setState("installLogs", prev => [message, ...prev]);
      if (status === "done") {
        setState("installState", "done");
        actions.addNotification("Dependencies installed successfully", "success");
        actions.checkDeps();
      } else if (status === "error") {
        setState("installState", "error");
        actions.addNotification("Dependency installation failed", "error");
      }
    });

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      buildUnlisten.then(f => f());
      installUnlisten.then(f => f());
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
