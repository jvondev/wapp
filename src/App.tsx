import { createSignal, onMount, For, Show } from "solid-js";
import "./App.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { 
  Folder, 
  Settings, 
  Play, 
  Trash2, 
  FolderOpen, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ChevronDown,
  ChevronUp,
  Plus,
  Globe,
  X
} from "lucide-solid";

// Interface Definitions
interface WappConfig {
  id: string;
  name: string;
  url: string;
  icon: string | null;
  width: number;
  height: number;
  hide_title_bar: boolean;
  category: string;
  created_at: string;
  path: string;
}

interface DependencyStatus {
  node_installed: boolean;
  rust_installed: boolean;
  pake_installed: boolean;
  node_version: string;
  rust_version: string;
}

interface BuildProgressEvent {
  app_id: string;
  message: string;
  status: string; // "running" | "success" | "error"
}

interface InstallProgressEvent {
  message: string;
  status: string; // "running" | "error" | "done"
}

interface ActiveBuild {
  id: string;
  name: string;
  url: string;
  logs: string[];
  state: "building" | "success" | "error";
  category: string;
}

interface SiteInfo {
  title: string | null;
  icon: string | null;
}

function App() {
  // Navigation & UI state
  const [activeTab, setActiveTab] = createSignal<"all" | "settings">("all");
  const [wapps, setWapps] = createSignal<WappConfig[]>([]);
  const [activeBuilds, setActiveBuilds] = createSignal<Record<string, ActiveBuild>>({});
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [depStatus, setDepStatus] = createSignal<DependencyStatus | null>(null);
  const [isCheckingDeps, setIsCheckingDeps] = createSignal(false);
  const [filterCategory, setFilterCategory] = createSignal<string>("All");

  // Form State
  const [formUrl, setFormUrl] = createSignal("");
  const [formName, setFormName] = createSignal("");
  const [formCategory, setFormCategory] = createSignal("All");
  const [formWidth, setFormWidth] = createSignal(1280);
  const [formHeight, setFormHeight] = createSignal(800);
  const [formHideTitle, setFormHideTitle] = createSignal(true);
  const [formMaximize, setFormMaximize] = createSignal(true);

  // UX Signals
  const [showAdvanced, setShowAdvanced] = createSignal(false);
  const [showTechLogs, setShowTechLogs] = createSignal(false);

  // Auto-install state
  const [installLogs, setInstallLogs] = createSignal<string[]>([]);
  const [installState, setInstallState] = createSignal<"idle" | "running" | "done" | "error">("idle");

  // Smart Favicon Fetching
  const [faviconUrl, setFaviconUrl] = createSignal("");
  const [isFetchingInfo, setIsFetchingInfo] = createSignal(false);

  // Real Site Info Fetcher
  const fetchSiteInfo = async (urlVal: string) => {
    if (!urlVal.includes(".") || urlVal.length < 4) return;
    
    setIsFetchingInfo(true);
    try {
      const info = await invoke<SiteInfo>("get_site_info", { url: urlVal });
      if (info.icon) setFaviconUrl(info.icon);
      if (info.title && !formName()) {
        // Clean up title (e.g. remove " - Home", " | Website")
        let cleanTitle = info.title.split(/ - | \| |: /)[0].trim();
        setFormName(cleanTitle);
      }
    } catch (err) {
      console.error("Failed to fetch site info:", err);
      // Fallback to simple logic if real fetch fails
      if (urlVal.includes(".")) {
        const cleanUrl = urlVal.startsWith("http") ? urlVal : `https://${urlVal}`;
        setFaviconUrl(`https://www.google.com/s2/favicons?domain=${cleanUrl}&sz=128`);
      }
    } finally {
      setIsFetchingInfo(false);
    }
  };

  // Update url and sync everything
  const handleUrlChange = (val: string) => {
    setFormUrl(val);
    // Real-time favicon update (fast fallback)
    if (val.includes(".")) {
      const cleanUrl = val.startsWith("http") ? val : `https://${val}`;
      setFaviconUrl(`https://www.google.com/s2/favicons?domain=${cleanUrl}&sz=128`);
    }
  };

  // Trigger real fetch on blur or manual trigger
  const handleUrlBlur = () => {
    autoFillName(); // Basic logic first
    fetchSiteInfo(formUrl()); // Real logic second
  };

  // Auto-fill app name on blur or enter key
  const autoFillName = () => {
    let urlVal = formUrl().trim();
    if (!urlVal) return;

    // Ensure protocol for parsing and interactive preview
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
          if (commonAppSubs.includes(sub)) {
            setFormName(`${brand} App`);
          } else {
            const subTitle = sub.charAt(0).toUpperCase() + sub.slice(1);
            setFormName(`${subTitle} ${brand}`);
          }
        } else {
          setFormName(brand);
        }
      }
    } catch (_) {}
  };

  // Check system requirements
  const checkSystemDeps = async () => {
    setIsCheckingDeps(true);
    try {
      const res = await invoke<DependencyStatus>("check_dependencies");
      setDepStatus(res);
    } catch (err) {
      console.error("Dependency check error:", err);
    } finally {
      setIsCheckingDeps(false);
    }
  };

  // Load configured wapps from backend
  const loadConfiguredWapps = async () => {
    try {
      const loaded = await invoke<WappConfig[]>("load_wapps");
      setWapps(loaded);
    } catch (err) {
      console.error("Load wapps error:", err);
    }
  };

  onMount(async () => {
    await checkSystemDeps();
    await loadConfiguredWapps();

    // Listen for build progress from Rust
    listen<BuildProgressEvent>("build-progress", (event) => {
      const payload = event.payload;
      setActiveBuilds(prev => {
        const build = prev[payload.app_id];
        if (!build) return prev;

        const updatedLogs = [payload.message, ...build.logs].slice(0, 100);
        const newState = payload.status === "running" ? "building" : 
                         payload.status === "success" ? "success" : "error";
        
        // If success, refresh wapps list
        if (newState === "success") {
          loadConfiguredWapps();
          // Remove from active builds after a delay or immediately
          setTimeout(() => {
             setActiveBuilds(current => {
               const next = {...current};
               delete next[payload.app_id];
               return next;
             });
          }, 3000);
        }

        return {
          ...prev,
          [payload.app_id]: {
            ...build,
            logs: updatedLogs,
            state: newState
          }
        };
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

  const handleBuildWapp = async (e: Event) => {
    e.preventDefault();
    if (!formUrl() || !formName()) return;

    const uniqueId = Math.random().toString(36).substring(2, 9);
    const name = formName();
    const url = formUrl();
    const category = formCategory();
    
    // Add to active builds
    setActiveBuilds(prev => ({
      ...prev,
      [uniqueId]: {
        id: uniqueId,
        name,
        url,
        logs: [`Initializing build for ${name}...`],
        state: "building",
        category
      }
    }));

    setShowAddModal(false);
    setActiveTab("all");
    
    // Reset form
    setFormUrl("");
    setFormName("");
    
    try {
      await invoke("build_wapp", {
        id: uniqueId,
        name,
        url,
        icon: null,
        width: formWidth(),
        height: formHeight(),
        hide_title_bar: formHideTitle(),
        category,
        created_at: new Date().toLocaleDateString(),
        maximize: formMaximize()
      });
    } catch (err) {
      setActiveBuilds(prev => ({
        ...prev,
        [uniqueId]: {
          ...prev[uniqueId],
          logs: [`Error: ${err}`, ...prev[uniqueId].logs],
          state: "error"
        }
      }));
    }
  };

  const launchWapp = async (path: string) => {
    try {
      await invoke("launch_wapp", { path });
    } catch (err) {
      alert(`Error launching: ${err}`);
    }
  };

  const deleteWapp = async (id: string) => {
    const updated = wapps().filter(w => w.id !== id);
    setWapps(updated);
    try {
      await invoke("save_wapps", { wapps: updated });
    } catch (err) {
      console.error("Save wapps error:", err);
    }
  };

  const openWorkspaceFolder = async () => {
    try {
      await invoke("open_workspace_folder");
    } catch (err) {
      console.error("Open workspace error:", err);
    }
  };

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
      {/* Sidebar navigation */}
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-logo">w</div>
          <span class="brand-name">wapp</span>
        </div>

        <button class="sidebar-add-btn" onClick={() => setShowAddModal(true)}>
          <Plus size={18} />
          New Wapp
        </button>

        <nav class="nav-group">
          <button 
            class="nav-item" 
            classList={{ active: activeTab() === "all" }}
            onClick={() => setActiveTab("all")}
          >
            <Folder size={16} />
            All Wapps
          </button>
          <button 
            class="nav-item" 
            classList={{ active: activeTab() === "settings" }}
            onClick={() => {
              setActiveTab("settings");
              setShowTechLogs(false);
            }}
          >
            <Settings size={16} />
            Setup Guide
          </button>
        </nav>

        <div class="sidebar-footer">
          <div class="status-badge" onClick={checkSystemDeps} style="cursor: pointer;">
            <div 
              class="status-dot" 
              classList={{ 
                active: !!depStatus()?.node_installed && !!depStatus()?.rust_installed, 
                inactive: !depStatus()?.node_installed || !depStatus()?.rust_installed 
              }} 
            />
            <span>
              {isCheckingDeps() 
                ? "Checking..." 
                : depStatus()?.node_installed && depStatus()?.rust_installed 
                  ? "System Ready" 
                  : "Setup Required"
              }
            </span>
          </div>
        </div>
      </aside>

      {/* Main Panel content views */}
      <main class="main-panel">
        <header class="header">
          <h2 class="header-title">
            {activeTab() === "all" && "All Wapps"}
            {activeTab() === "settings" && "Environment setup"}
          </h2>
          <Show when={activeTab() === "all"}>
            <button class="filter-btn border-btn" onClick={openWorkspaceFolder}>
              <FolderOpen size={12} />
              Open Folder
            </button>
          </Show>
        </header>

        <div class="content">
          <div class="tab-view">
            {/* All Wapps View */}
            <Show when={activeTab() === "all"}>
              <div class="workspace-header">
                <div class="workspace-filters">
                  <For each={["All", "Work", "Enterprise"]}>
                    {(cat) => (
                      <button 
                        class="filter-btn" 
                        classList={{ active: filterCategory() === cat }}
                        onClick={() => setFilterCategory(cat)}
                      >
                        {cat}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              <div class="wapp-grid">
                {/* Show Active Builds first */}
                <For each={filteredBuilds()}>
                  {(build) => (
                    <div class="wapp-card loading">
                      <div class="wapp-card-header">
                        <div class="wapp-icon">
                          <Loader2 size={16} class="loading-spinner" />
                        </div>
                        <div class="wapp-info">
                          <span class="wapp-name">{build.name}</span>
                          <span class="wapp-url">{build.state === "error" ? "Build failed" : "Building..."}</span>
                        </div>
                      </div>
                      <div class="wapp-card-body">
                         <span class="wapp-badge all">{build.category}</span>
                      </div>
                      <div class="wapp-card-footer">
                         <span class="wapp-date" style="color: #666; font-size: 0.6rem;">
                            {build.logs[0]?.substring(0, 30)}...
                         </span>
                         <Show when={build.state === "error"}>
                            <button class="btn-icon delete" onClick={() => {
                              setActiveBuilds(current => {
                                const next = {...current};
                                delete next[build.id];
                                return next;
                              });
                            }}>
                              <Trash2 size={12} />
                            </button>
                         </Show>
                      </div>
                    </div>
                  )}
                </For>

                {/* Show Installed Wapps */}
                <For each={filteredWapps()}>
                  {(wapp) => (
                    <div class="wapp-card">
                      <div class="wapp-card-header">
                        <div class="wapp-icon">
                          {wapp.name.charAt(0)}
                        </div>
                        <div class="wapp-info">
                          <span class="wapp-name">{wapp.name}</span>
                          <span class="wapp-url">{wapp.url.replace("https://", "").replace("http://", "")}</span>
                        </div>
                      </div>
                      <div class="wapp-card-body">
                        <span class={`wapp-badge ${wapp.category.toLowerCase()}`}>{wapp.category}</span>
                      </div>
                      <div class="wapp-card-footer">
                        <span class="wapp-date">{wapp.created_at}</span>
                        <div class="wapp-actions">
                          <button class="btn-icon" onClick={() => launchWapp(wapp.path)}>
                            <Play size={12} />
                          </button>
                          <button class="btn-icon delete" onClick={() => deleteWapp(wapp.id)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </For>

                {/* Empty State */}
                <Show when={filteredWapps().length === 0 && filteredBuilds().length === 0}>
                  <div class="empty-state">
                    <div class="empty-title">Your workspace is empty</div>
                    <div class="empty-desc">Convert your first website into a desktop app to see it here.</div>
                    <button class="btn-primary" onClick={() => setShowAddModal(true)} style="margin-top: 0.5rem; font-size: 0.8rem;">
                      Create your first wapp
                    </button>
                  </div>
                </Show>
              </div>
            </Show>

            {/* Settings View */}
            <Show when={activeTab() === "settings"}>
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
                        <Show when={depStatus()?.node_installed} fallback={<span class="dep-badge missing">Missing</span>}>
                          <span class="dep-badge ok">{depStatus()?.node_version}</span>
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
                        <Show when={depStatus()?.rust_installed} fallback={<span class="dep-badge missing">Missing</span>}>
                          <span class="dep-badge ok">Installed</span>
                          <CheckCircle2 size={14} color="#10b981" />
                        </Show>
                      </div>
                    </div>
                  </div>
                </div>

                <Show when={!depStatus()?.node_installed || !depStatus()?.rust_installed}>
                  <div class="settings-card" style="border-color: rgba(59, 130, 246, 0.3); background-color: rgba(59, 130, 246, 0.02);">
                    <h3>Automatic Setup</h3>
                    <p>Click below to download and install all missing dependencies automatically.</p>
                    
                    <button 
                      class="btn-primary" 
                      style="margin-top: 1rem; width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem;"
                      onClick={async () => {
                        if (installState() === "running") return;
                        setInstallLogs(["Starting automatic setup..."]);
                        setInstallState("running");
                        try {
                          await invoke("install_dependencies");
                        } catch (err) {
                          setInstallLogs(prev => [`Error: ${err}`, ...prev]);
                          setInstallState("error");
                        }
                      }}
                      disabled={installState() === "running"}
                    >
                      {installState() === "running" ? <Loader2 size={16} class="loading-spinner" /> : "Install Dependencies"}
                    </button>

                    <Show when={installState() !== "idle"}>
                      <div style="margin-top: 1rem; background: #000; border: 1px solid #333; border-radius: 4px; padding: 0.75rem; max-height: 150px; overflow-y: auto; font-family: monospace; font-size: 0.7rem;">
                        <For each={installLogs()}>
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
            </Show>
          </div>
        </div>
      </main>

      {/* Add App Command Center */}
      <Show when={showAddModal()}>
        <div class="command-center-overlay" onClick={() => { setShowAddModal(false); setShowAdvanced(false); }}>
          <div class="command-center-container" onClick={(e) => e.stopPropagation()}>
            
            {/* Live Interactive Preview */}
            <Show when={formUrl().length > 3 && formUrl().includes(".")}>
              <div class="floating-preview">
                <div class="preview-top-bar">
                  <Show when={faviconUrl()} fallback={<div class="wapp-icon" style="width: 20px; height: 20px; font-size: 0.6rem; border-radius: 4px;">{formName().charAt(0) || "W"}</div>}>
                    <img src={faviconUrl()} class="preview-favicon" />
                  </Show>
                  <div class="wapp-info" style="gap: 0;">
                    <span class="wapp-name" style="font-size: 0.8rem;">
                       {isFetchingInfo() ? "Fetching site info..." : (formName() || "Preview")}
                    </span>
                    <span class="wapp-url" style="font-size: 0.6rem;">{formUrl()}</span>
                  </div>
                  <div style="margin-left: auto; display: flex; gap: 0.5rem; align-items: center;">
                     {isFetchingInfo() && <Loader2 size={12} class="loading-spinner" />}
                     <button class="btn-icon" title="Settings" onClick={() => setShowAdvanced(!showAdvanced())}>
                        <Settings size={14} />
                     </button>
                  </div>
                </div>
                <iframe 
                  src={formUrl().startsWith("http") ? formUrl() : `https://${formUrl()}`} 
                  class="interactive-viewport"
                  title="Wapp Preview"
                />
              </div>
            </Show>

            <div style="position: relative;">
              <form onSubmit={handleBuildWapp} class="command-bar">
                <Globe size={24} style="color: #52525b" />
                <input 
                  autoFocus
                  type="text" 
                  class="command-input" 
                  placeholder="Paste URL (e.g. app.todoist.com)..." 
                  value={formUrl()}
                  onInput={(e) => handleUrlChange(e.currentTarget.value)}
                  onBlur={handleUrlBlur}
                />
                <button 
                  type="submit" 
                  class="btn-command"
                  style="padding: 0.6rem 1.25rem; font-size: 0.85rem;"
                  disabled={!formUrl() || !formName()}
                >
                  <Plus size={16} />
                  Create Wapp
                </button>
              </form>
            </div>

            {/* Advanced Settings Card */}
            <Show when={showAdvanced()}>
              <div class="advanced-card">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                   <h3 style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: #52525b; letter-spacing: 0.05em;">Configuration</h3>
                   <button class="btn-icon" onClick={() => setShowAdvanced(false)}><X size={14} /></button>
                </div>

                <div class="advanced-field-group">
                  <label>Application Name</label>
                  <input 
                    type="text" 
                    class="input-field" 
                    placeholder="e.g. Todoist App" 
                    value={formName()}
                    onInput={(e) => setFormName(e.currentTarget.value)}
                  />
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                  <div class="advanced-field-group">
                    <label>Category</label>
                    <select 
                      class="input-field" 
                      value={formCategory()} 
                      onChange={(e) => setFormCategory(e.currentTarget.value)}
                    >
                      <option value="All">All</option>
                      <option value="Work">Work</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div class="advanced-field-group">
                    <label>Window Style</label>
                    <div style="display: flex; align-items: center; gap: 1rem; height: 100%;">
                       <div style="display: flex; align-items: center; gap: 0.4rem;">
                          <input type="checkbox" checked={formHideTitle()} onChange={(e) => setFormHideTitle(e.currentTarget.checked)} />
                          <span style="font-size: 0.75rem;">Frameless</span>
                       </div>
                       <div style="display: flex; align-items: center; gap: 0.4rem;">
                          <input type="checkbox" checked={formMaximize()} onChange={(e) => setFormMaximize(e.currentTarget.checked)} />
                          <span style="font-size: 0.75rem;">Maximize</span>
                       </div>
                    </div>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                   <div class="advanced-field-group">
                      <label>Width</label>
                      <input type="number" class="input-field" value={formWidth()} onInput={(e) => setFormWidth(parseInt(e.currentTarget.value))} />
                   </div>
                   <div class="advanced-field-group">
                      <label>Height</label>
                      <input type="number" class="input-field" value={formHeight()} onInput={(e) => setFormHeight(parseInt(e.currentTarget.value))} />
                   </div>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </>
  );
}

export default App;
