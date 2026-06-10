import { createStore, produce } from "solid-js/store";
import { createContext, useContext, JSX, onMount, onCleanup } from "solid-js";
import { WappConfig, ActiveBuild, BuildProgressEvent, BuildInput, EditInput } from "../types";
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
  activeTab: "all" | "settings";
  filterCategory: string;
  showAddModal: boolean;
  notifications: Notification[];
  editingWapp: WappConfig | null;
  theme: "light" | "dark";
  isLoading: boolean;
}

const STORAGE_KEY = "wapp_prefs";

const initialState: AppState = {
  wapps: [],
  activeBuilds: {},
  activeTab: (localStorage.getItem(`${STORAGE_KEY}_tab`) as any) || "all",
  filterCategory: localStorage.getItem(`${STORAGE_KEY}_cat`) || "All",
  showAddModal: false,
  notifications: [],
  editingWapp: null,
  theme: (localStorage.getItem(`${STORAGE_KEY}_theme`) as any) || "light",
  isLoading: true,
};

const createAppStore = () => {
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
    setEditingWapp: (wapp: WappConfig | null) => setState("editingWapp", wapp),
    setTheme: (theme: "light" | "dark") => {
      setState("theme", theme);
      localStorage.setItem(`${STORAGE_KEY}_theme`, theme);
      if (theme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    },
    
    addNotification: (message: string, type: "success" | "error" | "info" = "info") => {
      const id = Math.random().toString(36).substring(7);
      setState("notifications", prev => [{ id, message, type, timestamp: Date.now() }, ...prev]);
      setTimeout(() => actions.removeNotification(id), 5000);
    },

    removeNotification: (id: string) => {
      setState("notifications", prev => prev.filter(n => n.id !== id));
    },


    loadWapps: async () => {
      setState("isLoading", true);
      try {
        const loaded = await tauriService.loadWapps();
        setState("wapps", loaded);
      } finally {
        setState("isLoading", false);
      }
    },

    deleteWapp: async (id: string) => {
      try {
        await tauriService.deleteWapp(id);
        const updated = state.wapps.filter(w => w.id !== id);
        setState("wapps", updated);
        actions.addNotification("Application removed", "info");
      } catch (err) {
        actions.addNotification(`Failed to delete: ${err}`, "error");
      }
    },

    cancelBuild: (id: string) => {
      setState("activeBuilds", produce(prev => { delete prev[id]; }));
    },

    startBuild: async (data: BuildInput, favicon: string) => {
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
          id: uniqueId,
          name: data.name,
          url: data.url,
          icon: favicon || null,
          width: data.width,
          height: data.height,
          hideTitleBar: data.hideTitle,
          category: data.category,
          createdAt: new Date().toLocaleDateString(),
          maximize: data.maximize,
          os: data.os || []
        });
      } catch (err) {
        setState("activeBuilds", uniqueId, produce(b => {
          b.logs = [`Error: ${err}`, ...b.logs];
          b.state = "error";
        }));
        actions.addNotification(`Build failed: ${err}`, "error");
      }
    },
    editWapp: async (wappId: string, data: EditInput, icon: string | null) => {
      try {
        await tauriService.editWapp({
          id: wappId,
          name: data.name,
          url: data.url,
          icon: icon,
          width: data.width,
          height: data.height,
          hideTitleBar: data.hideTitle,
          maximize: data.maximize,
          category: data.category,
        });
        actions.addNotification(`Saved ${data.name}`, "success");
        await actions.loadWapps();
      } catch (err) {
        actions.addNotification(`Failed to save: ${err}`, "error");
      }
    },
    setWapps: (wapps: WappConfig[]) => setState("wapps", wapps),
  };

  // Listeners
  onMount(() => {
    // Apply initial theme
    if (state.theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }

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
        setTimeout(() => actions.cancelBuild(app_id), 300); // 300ms instead of 3000ms
      } else if (newState === "error") {
        actions.addNotification(`Build failed for ${state.activeBuilds[app_id].name}`, "error");
      }
    });

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      buildUnlisten.then(f => f());
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
