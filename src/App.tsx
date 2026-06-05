import { createSignal, onMount, For, Show } from "solid-js";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import { listen } from "@tauri-apps/api/event";
import { FolderOpen } from "lucide-solid";

// Internal Modules
import { 
  WappConfig, 
  DependencyStatus, 
  BuildProgressEvent, 
  InstallProgressEvent, 
  ActiveBuild, 
  SiteInfo 
} from "./types";
import { tauriService } from "./services/tauri";
import { Sidebar } from "./components/Sidebar";
import { WappGrid } from "./components/WappGrid";
import { SettingsView } from "./components/SettingsView";
import { CommandCenter } from "./components/CommandCenter";

function App() {
  // Navigation & UI state
  const [activeTab, setActiveTab] = createSignal<"all" | "settings">("all");
  const [wapps, setWapps] = createSignal<WappConfig[]>([]);
  const [activeBuilds, setActiveBuilds] = createSignal<Record<string, ActiveBuild>>({});
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [depStatus, setDepStatus] = createSignal<DependencyStatus | null>(null);
  const [isCheckingDeps, setIsCheckingDeps] = createSignal(false);
  const [filterCategory, setFilterCategory] = createSignal<string>("All");

  // Form Metadata State (Used by CommandCenter)
  const [formUrl, setFormUrl] = createSignal("");
  const [formName, setFormName] = createSignal("");
  const [faviconUrl, setFaviconUrl] = createSignal("");
  const [isFetchingInfo, setIsFetchingInfo] = createSignal(false);

  // Auto-install state
  const [installLogs, setInstallLogs] = createSignal<string[]>([]);
  const [installState, setInstallState] = createSignal<"idle" | "running" | "done" | "error">("idle");

  // --- Logic & Actions ---

  const checkSystemDeps = async () => {
    setIsCheckingDeps(true);
    try {
      const res = await tauriService.checkDependencies();
      setDepStatus(res);
    } catch (err) {
      console.error("Dependency check error:", err);
    } finally {
      setIsCheckingDeps(false);
    }
  };

  const loadConfiguredWapps = async () => {
    try {
      const loaded = await tauriService.loadWapps();
      setWapps(loaded);
    } catch (err) {
      console.error("Load wapps error:", err);
    }
  };

  const fetchSiteInfo = async (urlVal: string) => {
    if (!urlVal.includes(".") || urlVal.length < 4) return;
    setIsFetchingInfo(true);
    try {
      const info = await tauriService.getSiteInfo(urlVal);
      if (info.icon) setFaviconUrl(info.icon);
      if (info.title && !formName()) {
        let cleanTitle = info.title.split(/ - | \| |: /)[0].trim();
        setFormName(cleanTitle);
      }
    } catch (err) {
      console.error("Failed to fetch site info:", err);
      const cleanUrl = urlVal.startsWith("http") ? urlVal : `https://${urlVal}`;
      setFaviconUrl(`https://www.google.com/s2/favicons?domain=${cleanUrl}&sz=128`);
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const handleUrlChange = (val: string) => {
    setFormUrl(val);
    if (val.includes(".")) {
      const cleanUrl = val.startsWith("http") ? val : `https://${val}`;
      setFaviconUrl(`https://www.google.com/s2/favicons?domain=${cleanUrl}&sz=128`);
    }
  };

  const autoFillName = () => {
    let urlVal = formUrl().trim();
    if (!urlVal) return;
    if (!urlVal.startsWith("http://") && !urlVal.startsWith("https://")) {
      urlVal = "https://" + urlVal;
      setFormUrl(urlVal);
    }
    if (formName()) return;
    try {
      const parsed = new URL(urlVal);
      const parts = parsed.hostname.replace("www.", "").split(".");
      if (parts.length >= 2) {
        let brand = parts[parts.length - 2];
        brand = brand.charAt(0).toUpperCase() + brand.slice(1);
        if (parts.length > 2) {
          const sub = parts[0].toLowerCase();
          const commonAppSubs = ["app", "web", "my", "dashboard", "console", "portal", "cloud"];
          if (commonAppSubs.includes(sub)) setFormName(`${brand} App`);
          else setFormName(`${sub.charAt(0).toUpperCase() + sub.slice(1)} ${brand}`);
        } else setFormName(brand);
      }
    } catch (_) {}
  };

  const handleBuildWapp = async (data: any) => {
    if (!data.url || !data.name) return;

    const uniqueId = Math.random().toString(36).substring(2, 9);
    setActiveBuilds(prev => ({
      ...prev,
      [uniqueId]: {
        id: uniqueId,
        name: data.name,
        url: data.url,
        logs: [`Initializing build for ${data.name}...`],
        state: "building",
        category: data.category
      }
    }));

    setShowAddModal(false);
    setActiveTab("all");
    setFormUrl("");
    setFormName("");
    setFaviconUrl("");
    
    try {
      await tauriService.buildWapp({
        id: uniqueId,
        name: data.name,
        url: data.url,
        icon: faviconUrl() || null,
        width: data.width,
        height: data.height,
        hide_title_bar: data.hideTitle,
        category: data.category,
        created_at: new Date().toLocaleDateString(),
        maximize: data.maximize
      });
    } catch (err) {
      setActiveBuilds(prev => ({
        ...prev,
        [uniqueId]: { ...prev[uniqueId], logs: [`Error: ${err}`, ...prev[uniqueId].logs], state: "error" }
      }));
    }
  };

  const handleInstallDeps = async () => {
    if (installState() === "running") return;
    setInstallLogs(["Starting automatic setup..."]);
    setInstallState("running");
    try {
      await tauriService.installDependencies();
    } catch (err) {
      setInstallLogs(prev => [`Error: ${err}`, ...prev]);
      setInstallState("error");
    }
  };

  onMount(async () => {
    await checkSystemDeps();
    await loadConfiguredWapps();

    listen<BuildProgressEvent>("build-progress", (event) => {
      const payload = event.payload;
      setActiveBuilds(prev => {
        const build = prev[payload.app_id];
        if (!build) return prev;
        const updatedLogs = [payload.message, ...build.logs].slice(0, 100);
        const newState = payload.status === "running" ? "building" : 
                         payload.status === "success" ? "success" : "error";
        if (newState === "success") {
          loadConfiguredWapps();
          setTimeout(() => {
             setActiveBuilds(current => {
               const next = {...current};
               delete next[payload.app_id];
               return next;
             });
          }, 3000);
        }
        return { ...prev, [payload.app_id]: { ...build, logs: updatedLogs, state: newState } };
      });
    });

    listen<InstallProgressEvent>("install-progress", (event) => {
      const payload = event.payload;
      setInstallLogs(prev => [payload.message, ...prev]);
      if (payload.status === "done") {
        setInstallState("done");
        checkSystemDeps();
      } else if (payload.status === "error") {
        setInstallState("error");
      }
    });
  });

  // --- Helpers ---
  const filteredWapps = () => {
    if (filterCategory() === "All") return wapps();
    return wapps().filter(w => w.category === filterCategory());
  };

  const filteredBuilds = () => {
    const builds = Object.values(activeBuilds());
    if (filterCategory() === "All") return builds;
    return builds.filter(b => b.category === filterCategory());
  };

  return (
    <>
      <Sidebar 
        activeTab={activeTab()} 
        setActiveTab={setActiveTab} 
        onAddClick={() => setShowAddModal(true)}
        depStatus={depStatus()}
        isCheckingDeps={isCheckingDeps()}
        onCheckDeps={checkSystemDeps}
      />

      <main class="main-panel">
        <header class="header">
          <h2 class="header-title">
            {activeTab() === "all" ? "All Wapps" : "Environment setup"}
          </h2>
          <Show when={activeTab() === "all"}>
            <button class="filter-btn border-btn" onClick={() => tauriService.openWorkspaceFolder()}>
              <FolderOpen size={12} />
              Open Folder
            </button>
          </Show>
        </header>

        <div class="content">
          <div class="tab-view">
            <Show when={activeTab() === "all"}>
              <WappGrid 
                wapps={filteredWapps()}
                activeBuilds={filteredBuilds()}
                filterCategory={filterCategory()}
                setFilterCategory={setFilterCategory}
                onLaunch={(path) => tauriService.launchWapp(path)}
                onDelete={async (id) => {
                  const updated = wapps().filter(w => w.id !== id);
                  setWapps(updated);
                  await tauriService.saveWapps(updated);
                }}
                onCancelBuild={(id) => {
                  setActiveBuilds(current => {
                    const next = {...current};
                    delete next[id];
                    return next;
                  });
                }}
                onOpenFolder={() => tauriService.openWorkspaceFolder()}
                onAddClick={() => setShowAddModal(true)}
              />
            </Show>

            <Show when={activeTab() === "settings"}>
              <SettingsView 
                depStatus={depStatus()}
                installState={installState()}
                installLogs={installLogs()}
                onInstall={handleInstallDeps}
              />
            </Show>
          </div>
        </div>
      </main>

      <CommandCenter 
        show={showAddModal()}
        onClose={() => { setShowAddModal(false); }}
        onSubmit={handleBuildWapp}
        faviconUrl={faviconUrl()}
        isFetchingInfo={isFetchingInfo()}
        formUrl={formUrl()}
        onUrlInput={handleUrlChange}
        onUrlBlur={() => { autoFillName(); fetchSiteInfo(formUrl()); }}
        formName={formName()}
        onNameInput={setFormName}
      />
    </>
  );
}

export default App;
