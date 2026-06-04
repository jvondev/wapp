import { createSignal, onMount, For, Show } from "solid-js";
import "./App.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { 
  Folder, 
  PlusCircle, 
  Settings, 
  Play, 
  Trash2, 
  FolderOpen, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Terminal, 
  RefreshCw,
  Download
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

function App() {
  // Navigation & UI state
  const [activeTab, setActiveTab] = createSignal<"workspace" | "create" | "settings">("workspace");
  const [wapps, setWapps] = createSignal<WappConfig[]>([]);
  const [depStatus, setDepStatus] = createSignal<DependencyStatus | null>(null);
  const [isCheckingDeps, setIsCheckingDeps] = createSignal(false);
  const [filterCategory, setFilterCategory] = createSignal<string>("All");

  // Form State
  const [formUrl, setFormUrl] = createSignal("");
  const [formName, setFormName] = createSignal("");
  const [formCategory, setFormCategory] = createSignal("Personal");
  const [formIcon, setFormIcon] = createSignal("");
  const [formWidth, setFormWidth] = createSignal(1200);
  const [formHeight, setFormHeight] = createSignal(780);
  const [formHideTitle, setFormHideTitle] = createSignal(false);

  // Build Output Terminal State
  const [currentBuildId, setCurrentBuildId] = createSignal<string | null>(null);
  const [buildLogs, setBuildLogs] = createSignal<string[]>([]);
  const [buildState, setBuildState] = createSignal<"idle" | "building" | "success" | "error">("idle");

  // Auto-install state
  const [installLogs, setInstallLogs] = createSignal<string[]>([]);
  const [installState, setInstallState] = createSignal<"idle" | "running" | "done" | "error">("idle");

  // Auto-fill app name from URL domain
  const handleUrlChange = (urlVal: string) => {
    setFormUrl(urlVal);
    if (!formName() && urlVal) {
      try {
        let domain = urlVal;
        if (!domain.startsWith("http://") && !domain.startsWith("https://")) {
          domain = "https://" + domain;
        }
        const parsed = new URL(domain);
        let hostname = parsed.hostname.replace("www.", "");
        const dotIdx = hostname.indexOf(".");
        if (dotIdx > 0) {
          hostname = hostname.substring(0, dotIdx);
        }
        // Capitalize
        const nameVal = hostname.charAt(0).toUpperCase() + hostname.slice(1);
        setFormName(nameVal);
      } catch (_) {
        // Ignore parsing errors
      }
    }
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

  // Trigger auto-install of Node.js + Rust
  const handleInstallDeps = async () => {
    if (installState() === "running") return;
    setInstallLogs(["Starting automatic setup..."]);
    setInstallState("running");
    try {
      await invoke("install_dependencies");
    } catch (err) {
      setInstallLogs(prev => [`Error: ${err}`, ...prev]);
      setInstallState("error");
    }
  };

  // Load configured wapps from backend
  const loadConfiguredWapps = async () => {
    try {
      const loaded = await invoke<WappConfig[]>("load_wapps");
      setWapps(loaded);
    } catch (err) {
      console.error("Failed loading wapps:", err);
    }
  };

  // Delete wapp configuration & registry
  const deleteWapp = async (id: string) => {
    const confirmDelete = window.confirm("Are you sure you want to remove this wapp from workspace?");
    if (!confirmDelete) return;

    try {
      const updated = wapps().filter(w => w.id !== id);
      setWapps(updated);
      await invoke("save_wapps", { wapps: updated });
    } catch (err) {
      console.error("Failed to delete wapp:", err);
    }
  };

  // Launch a wapp executable
  const launchWapp = async (path: string) => {
    try {
      await invoke("launch_wapp", { path });
    } catch (err) {
      alert(`Launch error: ${err}`);
    }
  };

  // Open wapps workspace directory in system explorer
  const openWorkspaceFolder = async () => {
    try {
      await invoke("open_workspace_folder");
    } catch (err) {
      console.error("Failed opening folder:", err);
    }
  };

  // Trigger building wapp via Pake
  const handleBuildWapp = async (e: Event) => {
    e.preventDefault();
    if (!formUrl() || !formName()) {
      alert("Please provide both target URL and App Name.");
      return;
    }

    // Check dependency status first
    if (depStatus() && !depStatus()?.node_installed) {
      alert("Node.js is required to run Pake. Please check Settings.");
      return;
    }

    const uniqueId = `wapp_${Date.now()}`;
    setCurrentBuildId(uniqueId);
    setBuildLogs([`Configuring build environment for ${formName()}...`]);
    setBuildState("building");

    // Standardize URL schema
    let targetUrl = formUrl().trim();
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl;
    }

    const dateStr = new Date().toLocaleString();

    try {
      // Trigger background compilation in Rust
      await invoke("build_wapp", {
        id: uniqueId,
        name: formName().trim(),
        url: targetUrl,
        icon: formIcon().trim() || null,
        width: formWidth(),
        height: formHeight(),
        hideTitleBar: formHideTitle(),
        category: formCategory(),
        createdAt: dateStr
      });
    } catch (err) {
      setBuildLogs(prev => [`Error initiating build: ${err}`, ...prev]);
      setBuildState("error");
    }
  };

  // Set up event listeners on mount
  onMount(() => {
    checkSystemDeps();
    loadConfiguredWapps();

    // Listen for build progress from Rust
    listen<BuildProgressEvent>("build-progress", (event) => {
      const payload = event.payload;
      if (payload.app_id !== currentBuildId()) return;
      setBuildLogs(prev => [payload.message, ...prev]);
      if (payload.status === "success") {
        setBuildState("success");
        loadConfiguredWapps();
        setFormUrl("");
        setFormName("");
        setFormIcon("");
      } else if (payload.status === "error") {
        setBuildState("error");
      }
    });

    // Listen for auto-install progress
    listen<InstallProgressEvent>("install-progress", (event) => {
      const { message, status } = event.payload;
      setInstallLogs(prev => [message, ...prev]);
      if (status === "done") {
        setInstallState("done");
        // Re-check deps after install finishes
        setTimeout(() => checkSystemDeps(), 1500);
      } else if (status === "error") {
        setInstallState("error");
      }
    });
  });

  // Filter wapps based on category selection
  const filteredWapps = () => {
    if (filterCategory() === "All") return wapps();
    return wapps().filter(w => w.category === filterCategory());
  };

  return (
    <>
      {/* Sidebar navigation */}
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-logo">w</div>
          <span class="brand-name">wapp</span>
        </div>

        <nav class="nav-group">
          <button 
            class="nav-item" 
            classList={{ active: activeTab() === "workspace" }}
            onClick={() => setActiveTab("workspace")}
          >
            <Folder size={18} />
            Workspace
          </button>
          <button 
            class="nav-item" 
            classList={{ active: activeTab() === "create" }}
            onClick={() => setActiveTab("create")}
          >
            <PlusCircle size={18} />
            Create Wapp
          </button>
          <button 
            class="nav-item" 
            classList={{ active: activeTab() === "settings" }}
            onClick={() => setActiveTab("settings")}
          >
            <Settings size={18} />
            Settings & Setup
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
                ? "Checking status..." 
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
            {activeTab() === "workspace" && "My Workspace"}
            {activeTab() === "create" && "Convert Web URL to App"}
            {activeTab() === "settings" && "Environment setup"}
          </h2>
          <Show when={activeTab() === "workspace"}>
            <button class="filter-btn" onClick={openWorkspaceFolder}>
              <FolderOpen size={14} style="margin-right: 0.25rem; display: inline-block; vertical-align: text-bottom;" />
              Open Folder
            </button>
          </Show>
        </header>

        <div class="content">
          {/* TAB 1: Workspace Grid view */}
          <Show when={activeTab() === "workspace"}>
            <div class="workspace-header">
              <div class="workspace-filters">
                <For each={["All", "Personal", "Work", "Enterprise"]}>
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

            <Show 
              when={filteredWapps().length > 0} 
              fallback={
                <div class="empty-state">
                  <Folder size={48} stroke-width={1.2} />
                  <div class="empty-title">Workspace is empty</div>
                  <div class="empty-desc">Create your first wapp from a web URL and launch it directly as a lightweight desktop app.</div>
                  <button class="btn-primary" onClick={() => setActiveTab("create")}>
                    <PlusCircle size={16} />
                    Create First Wapp
                  </button>
                </div>
              }
            >
              <div class="wapp-grid">
                <For each={filteredWapps()}>
                  {(wapp) => (
                    <div class="wapp-card">
                      <div class="wapp-card-header">
                        <div class="wapp-icon">
                          {wapp.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div class="wapp-info">
                          <span class="wapp-name">{wapp.name}</span>
                          <span class="wapp-url" title={wapp.url}>{wapp.url}</span>
                        </div>
                      </div>
                      <div class="wapp-card-body">
                        <span class={`wapp-badge ${wapp.category.toLowerCase()}`}>
                          {wapp.category}
                        </span>
                      </div>
                      <div class="wapp-card-footer">
                        <span class="wapp-date">Created {wapp.created_at.split(",")[0]}</span>
                        <div class="wapp-actions">
                          <button class="btn-icon" title="Launch App" onClick={() => launchWapp(wapp.path)}>
                            <Play size={14} fill="currentColor" />
                          </button>
                          <button class="btn-icon delete" title="Delete config" onClick={() => deleteWapp(wapp.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>

          {/* TAB 2: Build Creator Form */}
          <Show when={activeTab() === "create"}>
            <div class="form-container">
              <h3 class="form-title">Create Desktop App</h3>
              <p class="form-subtitle">Convert any responsive website or web dashboard into a native executable.</p>
              
              <form onSubmit={handleBuildWapp}>
                <div class="form-group">
                  <label for="url">Website URL</label>
                  <input 
                    type="text" 
                    id="url" 
                    placeholder="https://example.com" 
                    value={formUrl()}
                    onInput={(e) => handleUrlChange(e.currentTarget.value)}
                    required
                    disabled={buildState() === "building"}
                  />
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="name">App Name</label>
                    <input 
                      type="text" 
                      id="name" 
                      placeholder="e.g. ExampleApp" 
                      value={formName()}
                      onInput={(e) => setFormName(e.currentTarget.value)}
                      required
                      disabled={buildState() === "building"}
                    />
                  </div>
                  <div class="form-group">
                    <label for="category">Workspace Category</label>
                    <select 
                      id="category" 
                      value={formCategory()}
                      onChange={(e) => setFormCategory(e.currentTarget.value)}
                      disabled={buildState() === "building"}
                    >
                      <option value="Personal">Personal</option>
                      <option value="Work">Work</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label for="icon">Custom Icon Path / URL (Optional)</label>
                  <input 
                    type="text" 
                    id="icon" 
                    placeholder="Local .ico/.png path or icon link" 
                    value={formIcon()}
                    onInput={(e) => setFormIcon(e.currentTarget.value)}
                    disabled={buildState() === "building"}
                  />
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="width">Default Width</label>
                    <input 
                      type="number" 
                      id="width" 
                      value={formWidth()}
                      onInput={(e) => setFormWidth(parseInt(e.currentTarget.value) || 1200)}
                      disabled={buildState() === "building"}
                    />
                  </div>
                  <div class="form-group">
                    <label for="height">Default Height</label>
                    <input 
                      type="number" 
                      id="height" 
                      value={formHeight()}
                      onInput={(e) => setFormHeight(parseInt(e.currentTarget.value) || 780)}
                      disabled={buildState() === "building"}
                    />
                  </div>
                </div>

                <div class="toggle-group">
                  <div class="toggle-info">
                    <label>Minimal Borderless View</label>
                    <div class="toggle-label-desc">Hide window header and native title bars.</div>
                  </div>
                  <label class="switch">
                    <input 
                      type="checkbox" 
                      checked={formHideTitle()}
                      onChange={(e) => setFormHideTitle(e.currentTarget.checked)}
                      disabled={buildState() === "building"}
                    />
                    <span class="slider"></span>
                  </label>
                </div>

                <button 
                  type="submit" 
                  class="btn-primary" 
                  style="width: 100%;"
                  disabled={buildState() === "building"}
                >
                  <Show when={buildState() === "building"} fallback={<PlusCircle size={18} />}>
                    <Loader2 class="animate-spin" size={18} style="animation: spin 1s linear infinite;" />
                  </Show>
                  {buildState() === "building" ? "Packaging Desktop Executable..." : "Compile Desktop App"}
                </button>
              </form>

              {/* Build Process Terminal Output */}
              <Show when={buildState() !== "idle"}>
                <div class="terminal-container">
                  <div class="terminal-header">
                    <div class="terminal-dots">
                      <div class="terminal-dot red"></div>
                      <div class="terminal-dot yellow"></div>
                      <div class="terminal-dot green"></div>
                    </div>
                    <span>wapp-pack console logs</span>
                    <Terminal size={12} />
                  </div>
                  <div class="terminal-body">
                    <For each={buildLogs()}>
                      {(log) => <div style="margin-bottom: 2px;">{log}</div>}
                    </For>
                  </div>
                </div>

                <Show when={buildState() === "success"}>
                  <div style="background-color: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); border-radius: 6px; padding: 1rem; margin-top: 1rem; display: flex; align-items: center; gap: 0.75rem; color: #4ade80;">
                    <CheckCircle2 size={20} />
                    <div>
                      <div style="font-weight: 600;">Build Success!</div>
                      <div style="font-size: 0.8rem; color: rgba(255,255,255,0.7);">Your desktop app has been compiled successfully. You can launch it from the Workspace tab.</div>
                    </div>
                  </div>
                </Show>

                <Show when={buildState() === "error"}>
                  <div style="background-color: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 6px; padding: 1rem; margin-top: 1rem; display: flex; align-items: center; gap: 0.75rem; color: #f87171;">
                    <XCircle size={20} />
                    <div>
                      <div style="font-weight: 600;">Build Failed</div>
                      <div style="font-size: 0.8rem; color: rgba(255,255,255,0.7);">Something went wrong during compilation. Please ensure Node.js is installed, and the target URL is valid.</div>
                    </div>
                  </div>
                </Show>
              </Show>
            </div>
          </Show>

          {/* TAB 3: Settings & Requirements Setup Guide */}
          <Show when={activeTab() === "settings"}>
            <div class="settings-container">
              <div class="settings-card">
                <h3>System Requirements Status</h3>
                <p style="font-size: 0.85rem; color: hsl(var(--muted-foreground)); margin-bottom: 1rem;">
                  wapp uses the rust-based <code style="color: #60a5fa;">pake</code> compiler under the hood to output lightweight desktop packages.
                </p>

                <div class="dep-list">
                  <div class="dep-item">
                    <div class="dep-info">
                      <span class="dep-title">Node.js Environment</span>
                      <span class="dep-desc">Required to run pake-cli package orchestrator.</span>
                    </div>
                    <div class="dep-status">
                      <span style="font-size: 0.8rem; color: hsl(var(--muted-foreground));">
                        {depStatus()?.node_version}
                      </span>
                      <Show when={depStatus()?.node_installed} fallback={<span class="dep-badge missing">Missing</span>}>
                        <span class="dep-badge ok">Installed</span>
                      </Show>
                    </div>
                  </div>

                  <div class="dep-item">
                    <div class="dep-info">
                      <span class="dep-title">Rust & Cargo Compiler</span>
                      <span class="dep-desc">Required to build local desktop binary wrappers.</span>
                    </div>
                    <div class="dep-status">
                      <span style="font-size: 0.8rem; color: hsl(var(--muted-foreground));">
                        {depStatus()?.rust_version}
                      </span>
                      <Show when={depStatus()?.rust_installed} fallback={<span class="dep-badge missing">Missing</span>}>
                        <span class="dep-badge ok">Installed</span>
                      </Show>
                    </div>
                  </div>
                </div>

                <button 
                  class="btn-primary" 
                  onClick={checkSystemDeps} 
                  disabled={isCheckingDeps()}
                  style="margin-top: 1.5rem;"
                >
                  <RefreshCw size={16} class={isCheckingDeps() ? "animate-spin" : ""} style={isCheckingDeps() ? "animation: spin 1s linear infinite;" : ""} />
                  Refresh Environment Status
                </button>
              </div>

              {/* One-click Auto Installer */}
              <div class="settings-card">
                <h3>One-Click Auto Setup</h3>
                <p style="font-size: 0.85rem; color: hsl(var(--muted-foreground)); margin-bottom: 1.25rem;">
                  Let wapp install everything for you automatically. Node.js and Rust will be downloaded and configured in the background — no technical knowledge needed.
                </p>

                <Show when={installState() === "idle" || installState() === "done" || installState() === "error"}>
                  <button
                    class="btn-primary"
                    style="width: 100%; margin-top: 0;"
                    onClick={handleInstallDeps}
                    disabled={depStatus()?.node_installed && depStatus()?.rust_installed}
                  >
                    <Download size={18} />
                    {depStatus()?.node_installed && depStatus()?.rust_installed
                      ? "All Dependencies Installed"
                      : installState() === "done"
                        ? "Run Again"
                        : "Install Everything Automatically"
                    }
                  </button>
                  <Show when={depStatus()?.node_installed && depStatus()?.rust_installed}>
                    <div style="font-size: 0.78rem; color: #4ade80; margin-top: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
                      <CheckCircle2 size={14} /> System is already fully set up.
                    </div>
                  </Show>
                </Show>

                <Show when={installState() === "running"}>
                  <button class="btn-primary" style="width: 100%; margin-top: 0;" disabled>
                    <Loader2 class="animate-spin" size={18} style="animation: spin 1s linear infinite;" />
                    Installing… please wait
                  </button>
                </Show>

                <Show when={installState() !== "idle"}>
                  <div class="terminal-container" style="margin-top: 1rem;">
                    <div class="terminal-header">
                      <div class="terminal-dots">
                        <div class="terminal-dot red" />
                        <div class="terminal-dot yellow" />
                        <div class="terminal-dot green" />
                      </div>
                      <span>wapp-setup console</span>
                      <Terminal size={12} />
                    </div>
                    <div class="terminal-body">
                      <For each={installLogs()}>
                        {(log) => <div style="margin-bottom: 2px;">{log}</div>}
                      </For>
                    </div>
                  </div>
                </Show>

                <Show when={installState() === "done"}>
                  <div style="background-color: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); border-radius: 6px; padding: 0.875rem; margin-top: 0.75rem; display: flex; align-items: center; gap: 0.75rem; color: #4ade80; font-size: 0.85rem;">
                    <CheckCircle2 size={18} />
                    <div>
                      <div style="font-weight: 600;">Setup Complete!</div>
                      <div style="font-size: 0.78rem; color: rgba(255,255,255,0.6);">Restart wapp and click "Refresh" above to verify your environment.</div>
                    </div>
                  </div>
                </Show>

                <Show when={installState() === "error"}>
                  <div style="background-color: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 6px; padding: 0.875rem; margin-top: 0.75rem; display: flex; align-items: center; gap: 0.75rem; color: #f87171; font-size: 0.85rem;">
                    <XCircle size={18} />
                    <div>
                      <div style="font-weight: 600;">Installation Error</div>
                      <div style="font-size: 0.78rem; color: rgba(255,255,255,0.6);">Check the console above. You may need internet access or admin rights.</div>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </main>

      {/* Tailwind/CSS Animation overrides */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </>
  );
}

export default App;
