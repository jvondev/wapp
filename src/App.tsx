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
  Download,
  Globe,
  ChevronDown,
  ChevronUp
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
  const [formCategory, setFormCategory] = createSignal("Inbox");
  const [formIcon, setFormIcon] = createSignal("");
  const [formWidth, setFormWidth] = createSignal(1280);
  const [formHeight, setFormHeight] = createSignal(800);
  const [formHideTitle, setFormHideTitle] = createSignal(true);
  const [formMaximize, setFormMaximize] = createSignal(true);

  // UX Signals
  const [showAdvanced, setShowAdvanced] = createSignal(false);
  const [tipIndex, setTipIndex] = createSignal(0);
  const [showTechLogs, setShowTechLogs] = createSignal(false);

  // Build Output Terminal State
  const [currentBuildId, setCurrentBuildId] = createSignal<string | null>(null);
  const [buildLogs, setBuildLogs] = createSignal<string[]>([]);
  const [buildState, setBuildState] = createSignal<"idle" | "building" | "success" | "error">("idle");

  // Auto-install state
  const [installLogs, setInstallLogs] = createSignal<string[]>([]);
  const [installState, setInstallState] = createSignal<"idle" | "running" | "done" | "error">("idle");

  // Update url state only
  const handleUrlChange = (urlVal: string) => {
    setFormUrl(urlVal);
  };

  // Auto-fill app name on blur or enter key, ensuring complete typing
  const autoFillName = () => {
    const urlVal = formUrl().trim();
    if (!urlVal || formName()) return;

    try {
      let domain = urlVal;
      if (!domain.startsWith("http://") && !domain.startsWith("https://")) {
        domain = "https://" + domain;
      }
      const parsed = new URL(domain);
      if (parsed.hostname.includes(".")) {
        let hostname = parsed.hostname.replace("www.", "");
        const dotIdx = hostname.indexOf(".");
        if (dotIdx > 0) {
          hostname = hostname.substring(0, dotIdx);
        }
        if (hostname.length > 1) {
          const nameVal = hostname.charAt(0).toUpperCase() + hostname.slice(1);
          setFormName(nameVal);
        }
      }
    } catch (_) {
      // Ignore parsing errors
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
        createdAt: dateStr,
        maximize: formMaximize()
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

    // Clean rotating tips interval
    const tipsInterval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % tips.length);
    }, 5000);

    return () => clearInterval(tipsInterval);
  });

  const tips = [
    "Shared build caching is enabled: subsequent compilations will take less than 30 seconds.",
    "Borderless view hides standard window headers for a cleaner, modern look.",
    "Converted apps run entirely locally in isolated native sandboxes.",
    "You can configure custom window dimensions under the Advanced Options menu.",
    "The final executable is saved directly in your workspace folder."
  ];

  const currentStep = () => {
    if (buildState() === "success") return 3;
    if (buildState() === "error") return -1;
    if (buildState() === "building") {
      const logs = buildLogs().join("\n");
      if (logs.includes("Successfully") || logs.includes("packaging completed") || logs.includes("executable")) {
        return 3;
      }
      if (logs.includes("Compiling") || logs.includes("Building") || logs.includes("pake-cli")) {
        return 2;
      }
      return 1;
    }
    return 0;
  };

  const installStep = () => {
    if (installState() === "done") return 3;
    if (installState() === "error") return -1;
    if (installState() === "running") {
      const logs = installLogs().join("\n");
      if (logs.includes("Installing Rust") || logs.includes("Rustup") || logs.includes("rustup")) {
        return 2;
      }
      return 1;
    }
    return 0;
  };

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
            <Folder size={16} />
            Workspace
          </button>
          <button 
            class="nav-item" 
            classList={{ active: activeTab() === "create" }}
            onClick={() => setActiveTab("create")}
          >
            <PlusCircle size={16} />
            Convert URL
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
            {activeTab() === "workspace" && "Workspace"}
            {activeTab() === "create" && "Convert Web URL to App"}
            {activeTab() === "settings" && "Environment setup"}
          </h2>
          <Show when={activeTab() === "workspace"}>
            <button class="filter-btn border-btn" onClick={openWorkspaceFolder}>
              <FolderOpen size={12} />
              Open Folder
            </button>
          </Show>
        </header>

        <div class="content">
          <div class="tab-view">
            {/* TAB 1: Workspace Grid view */}
            <Show when={activeTab() === "workspace"}>
              <div class="workspace-header">
                <div class="workspace-filters">
                  <For each={["All", "Inbox", "Work", "Enterprise"]}>
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
                    <Folder size={36} stroke-width={1.5} />
                    <div class="empty-title">No Apps in Workspace</div>
                    <div class="empty-desc">Convert any responsive website or web dashboard into a native desktop executable.</div>
                    <button class="btn-primary" onClick={() => setActiveTab("create")} style="margin-top: 0.5rem; font-size: 0.8rem; padding: 0.5rem 1rem;">
                      <PlusCircle size={14} />
                      Convert First Website
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
                          <span class="wapp-date">{wapp.created_at.split(",")[0]}</span>
                          <div class="wapp-actions">
                            <button class="btn-icon" title="Launch App" onClick={() => launchWapp(wapp.path)}>
                              <Play size={10} fill="currentColor" />
                            </button>
                            <button class="btn-icon delete" title="Delete config" onClick={() => deleteWapp(wapp.id)}>
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Show>

            {/* TAB 2: Build Creator (Non-form UI) */}
            <Show when={activeTab() === "create"}>
              <div class="creator-container">
                <Show when={buildState() === "idle"}>
                  <div class="creator-hero">
                    <h1>Convert Website to App</h1>
                    <p>Enter any URL to bundle it into a clean, lightweight native desktop binary.</p>
                  </div>

                  {/* Command Bar (UX replacing standard form) */}
                  <div class="command-bar">
                    <Globe size={18} style="color: #4b5563;" />
                    <div class="command-input-container">
                      <input 
                        type="text"
                        class="command-input"
                        placeholder="Paste web link here... (e.g. linear.app)"
                        value={formUrl()}
                        onInput={(e) => handleUrlChange(e.currentTarget.value)}
                        onBlur={autoFillName}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            autoFillName();
                            handleBuildWapp(e);
                          }
                        }}
                      />
                    </div>
                    <button 
                      class="command-btn"
                      onClick={handleBuildWapp}
                      disabled={!formUrl()}
                    >
                      Convert App
                    </button>
                  </div>

                  {/* Advanced Options Accordion */}
                  <div style="margin-top: 0.5rem;">
                    <button 
                      class="advanced-settings-toggle"
                      onClick={() => setShowAdvanced(!showAdvanced())}
                    >
                      <Settings size={12} />
                      {showAdvanced() ? "Hide Options" : "Advanced Options"}
                      <Show when={showAdvanced()} fallback={<ChevronDown size={12} />}>
                        <ChevronUp size={12} />
                      </Show>
                    </button>

                    <Show when={showAdvanced()}>
                      <div class="advanced-panel" style="margin-top: 0.75rem;">

                        {/* App Name */}
                        <div class="advanced-row">
                          <div class="row-info">
                            <div class="row-title">App Name</div>
                            <div class="row-desc">Auto-detected from URL. Override if needed.</div>
                          </div>
                          <input
                            type="text"
                            id="appName"
                            class="input-field row-input"
                            placeholder="e.g. Linear"
                            value={formName()}
                            onInput={(e) => setFormName(e.currentTarget.value)}
                          />
                        </div>

                        {/* Category */}
                        <div class="advanced-row">
                          <div class="row-info">
                            <div class="row-title">Category</div>
                            <div class="row-desc">Organizes apps in your workspace.</div>
                          </div>
                          <select
                            id="appCategory"
                            class="input-field row-input"
                            value={formCategory()}
                            onChange={(e) => setFormCategory(e.currentTarget.value)}
                          >
                            <option value="Inbox">Inbox</option>
                            <option value="Work">Work</option>
                            <option value="Enterprise">Enterprise</option>
                          </select>
                        </div>

                        {/* Custom Icon */}
                        <div class="advanced-row">
                          <div class="row-info">
                            <div class="row-title">Custom Icon</div>
                            <div class="row-desc">Optional. Local .png / .ico path or URL.</div>
                          </div>
                          <input
                            type="text"
                            id="appIcon"
                            class="input-field row-input"
                            placeholder="path or URL"
                            value={formIcon()}
                            onInput={(e) => setFormIcon(e.currentTarget.value)}
                          />
                        </div>

                        {/* Maximize on Launch */}
                        <div class="advanced-row toggle">
                          <div class="row-info">
                            <div class="row-title">Maximize on Launch</div>
                            <div class="row-desc">Start the app window fully expanded.</div>
                          </div>
                          <label class="switch">
                            <input
                              type="checkbox"
                              checked={formMaximize()}
                              onChange={(e) => setFormMaximize(e.currentTarget.checked)}
                            />
                            <span class="slider"></span>
                          </label>
                        </div>

                        {/* Window Size — only shown when not maximized */}
                        <Show when={!formMaximize()}>
                          <div class="advanced-row">
                            <div class="row-info">
                              <div class="row-title">Window Size</div>
                              <div class="row-desc">Default width × height in pixels.</div>
                            </div>
                            <div style="display: flex; gap: 0.5rem; max-width: 220px; width: 100%;">
                              <input
                                type="number"
                                id="appWidth"
                                class="input-field"
                                style="flex: 1; min-width: 0;"
                                value={formWidth()}
                                onInput={(e) => setFormWidth(parseInt(e.currentTarget.value) || 1280)}
                              />
                              <span style="color: hsl(var(--muted-foreground)); line-height: 2rem; font-size: 0.75rem;">×</span>
                              <input
                                type="number"
                                id="appHeight"
                                class="input-field"
                                style="flex: 1; min-width: 0;"
                                value={formHeight()}
                                onInput={(e) => setFormHeight(parseInt(e.currentTarget.value) || 800)}
                              />
                            </div>
                          </div>
                        </Show>

                        {/* Borderless Window */}
                        <div class="advanced-row toggle">
                          <div class="row-info">
                            <div class="row-title">Borderless Window</div>
                            <div class="row-desc">Remove the system titlebar for a cleaner look.</div>
                          </div>
                          <label class="switch">
                            <input
                              type="checkbox"
                              checked={formHideTitle()}
                              onChange={(e) => setFormHideTitle(e.currentTarget.checked)}
                            />
                            <span class="slider"></span>
                          </label>
                        </div>

                      </div>
                    </Show>
                  </div>

                  {/* App Live Mock Preview */}
                  <Show when={formUrl() || formName()}>
                    <div style="margin-top: 1rem;">
                      <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: hsl(var(--muted-foreground)); margin-bottom: 0.5rem; text-align: center;">Live Preview</div>
                      <div class="preview-container">
                        <div class="preview-header">
                          <div class="preview-window-dots">
                            <div class="preview-dot" />
                            <div class="preview-dot" />
                            <div class="preview-dot" />
                          </div>
                          <div class="preview-title">{formHideTitle() ? "" : (formName() || "App Preview")}</div>
                          <div style="width: 32px" />
                        </div>
                        <div class="preview-body">
                          <div class="preview-app-icon">
                            {(formName() || "W").substring(0, 2).toUpperCase()}
                          </div>
                          <div class="preview-app-details">
                            <div class="preview-app-name">{formName() || "Enter a URL to preview..."}</div>
                            <div class="preview-app-meta">{formUrl() || "No URL provided"} • {formCategory()}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Show>
                </Show>

                {/* Building / Compile progressive state */}
                <Show when={buildState() !== "idle"}>
                  <div class="progress-screen">
                    <Show when={buildState() === "building"}>
                      <div class="loader-element">
                        <div class="loader-ring" />
                        <div class="loader-ring" />
                        <div class="loader-ring" />
                      </div>
                      <div class="progress-info">
                        <span class="progress-heading">Building desktop application...</span>
                        <span class="progress-subheading">We are generating a highly-optimized desktop build for <strong>{formName()}</strong>. Caches are active to minimize compiling wait times.</span>
                      </div>

                      {/* Timeline Steps Visualizer */}
                      <div class="stepper-container">
                        <div class="stepper-step" classList={{ active: currentStep() === 1, completed: currentStep() > 1 }}>
                          <div class="step-indicator">1</div>
                          <div class="step-title">Initializing build settings</div>
                        </div>
                        <div class="stepper-step" classList={{ active: currentStep() === 2, completed: currentStep() > 2 }}>
                          <div class="step-indicator">2</div>
                          <div class="step-title">Compiling binaries & loading cache</div>
                        </div>
                        <div class="stepper-step" classList={{ active: currentStep() === 3, completed: currentStep() > 3 }}>
                          <div class="step-indicator">3</div>
                          <div class="step-title">Generating local executable</div>
                        </div>
                      </div>

                      {/* Rotating Tips to entertain user */}
                      <div class="tips-container">
                        <div class="tips-title">Did you know?</div>
                        <div class="tips-content">"{tips[tipIndex()]}"</div>
                      </div>
                    </Show>

                    {/* Success Outcome */}
                    <Show when={buildState() === "success"}>
                      <CheckCircle2 size={36} style="color: #10b981;" />
                      <div class="progress-info">
                        <span class="progress-heading" style="color: #10b981;">App successfully built!</span>
                        <span class="progress-subheading">Your desktop wrapper for <strong>{formName()}</strong> is ready. You can now launch it directly from the Workspace tab.</span>
                      </div>
                      <button class="btn-primary" onClick={() => { setBuildState("idle"); setActiveTab("workspace"); }} style="margin-top: 0.5rem; font-size: 0.8rem;">
                        Go to Workspace
                      </button>
                    </Show>

                    {/* Error Outcome */}
                    <Show when={buildState() === "error"}>
                      <XCircle size={36} style="color: #ef4444;" />
                      <div class="progress-info">
                        <span class="progress-heading" style="color: #ef4444;">Compilation Failed</span>
                        <span class="progress-subheading">Something went wrong while compiling. Make sure your URL is reachable and dependencies are ready.</span>
                      </div>
                      <button class="btn-primary" onClick={() => setBuildState("idle")} style="margin-top: 0.5rem; font-size: 0.8rem;">
                        Try Again
                      </button>
                    </Show>

                    {/* Technical Output Toggle */}
                    <div>
                      <button class="tech-logs-btn" onClick={() => setShowTechLogs(!showTechLogs())}>
                        {showTechLogs() ? "Hide compiler logs" : "View technical compiler logs"}
                      </button>
                      <Show when={showTechLogs()}>
                        <div class="terminal-container" style="text-align: left; width: 100%; max-width: 500px;">
                          <div class="terminal-header">
                            <div class="terminal-dots">
                              <div class="terminal-dot red" />
                              <div class="terminal-dot yellow" />
                              <div class="terminal-dot green" />
                            </div>
                            <span>pake-cli logs</span>
                            <Terminal size={10} />
                          </div>
                          <div class="terminal-body" style="height: 120px; font-size: 0.75rem;">
                            <For each={buildLogs()}>
                              {(log) => <div style="margin-bottom: 1px;">{log}</div>}
                            </For>
                          </div>
                        </div>
                      </Show>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>

            {/* TAB 3: Settings & Requirements Setup Guide */}
            <Show when={activeTab() === "settings"}>
              <div class="settings-container">
                <div class="settings-card">
                  <h3>System Environment Requirements</h3>
                  <p>wapp utilizes the open-source Rust-based compiler engine for rendering web app executables.</p>

                  <div class="dep-list">
                    <div class="dep-item">
                      <div class="dep-info">
                        <span class="dep-title">Node.js Runtime</span>
                        <span class="dep-desc">Orchestrates packaging workflows.</span>
                      </div>
                      <div class="dep-status">
                        <span style="color: hsl(var(--muted-foreground));">
                          {depStatus()?.node_version || "Checking..."}
                        </span>
                        <Show when={depStatus()?.node_installed} fallback={<span class="dep-badge missing">Missing</span>}>
                          <span class="dep-badge ok">Ready</span>
                        </Show>
                      </div>
                    </div>

                    <div class="dep-item">
                      <div class="dep-info">
                        <span class="dep-title">Rust & Cargo Toolkit</span>
                        <span class="dep-desc">Compiles optimized binary wrappers.</span>
                      </div>
                      <div class="dep-status">
                        <span style="color: hsl(var(--muted-foreground));">
                          {depStatus()?.rust_version || "Checking..."}
                        </span>
                        <Show when={depStatus()?.rust_installed} fallback={<span class="dep-badge missing">Missing</span>}>
                          <span class="dep-badge ok">Ready</span>
                        </Show>
                      </div>
                    </div>
                  </div>

                  <button 
                    class="btn-primary" 
                    onClick={checkSystemDeps} 
                    disabled={isCheckingDeps()}
                    style="margin-top: 1rem; font-size: 0.8rem; padding: 0.5rem 1rem;"
                  >
                    <RefreshCw size={12} class={isCheckingDeps() ? "animate-spin" : ""} />
                    Scan System Requirements
                  </button>
                </div>

                {/* One-click Auto Installer */}
                <div class="settings-card">
                  <h3>Automated Setup Wizard</h3>
                  <p>Download, verify, and register Rust toolchains and Node.js dependencies natively without technical inputs.</p>

                  <Show when={installState() === "idle" || installState() === "done" || installState() === "error"}>
                    <button
                      class="btn-primary"
                      style="width: 100%; margin-top: 1rem; font-size: 0.8rem;"
                      onClick={handleInstallDeps}
                      disabled={depStatus()?.node_installed && depStatus()?.rust_installed}
                    >
                      <Download size={14} />
                      {depStatus()?.node_installed && depStatus()?.rust_installed
                        ? "Requirements Fully Satisfied"
                        : installState() === "done"
                          ? "Run Auto-Installer Again"
                          : "Install All Environment Tools"
                      }
                    </button>
                    <Show when={depStatus()?.node_installed && depStatus()?.rust_installed}>
                      <div style="font-size: 0.72rem; color: #10b981; margin-top: 0.5rem; display: flex; align-items: center; gap: 0.25rem; justify-content: center;">
                        <CheckCircle2 size={12} /> Environment fully established. No action needed.
                      </div>
                    </Show>
                  </Show>

                  <Show when={installState() === "running"}>
                    <div class="progress-screen" style="margin-top: 1rem; padding: 1.25rem;">
                      <div class="loader-element" style="width: 40px; height: 40px;">
                        <div class="loader-ring" style="width: 32px; height: 32px; border-width: 2px;" />
                        <div class="loader-ring" style="width: 32px; height: 32px; border-width: 2px;" />
                        <div class="loader-ring" style="width: 32px; height: 32px; border-width: 2px;" />
                      </div>
                      <div class="progress-info">
                        <span class="progress-heading">Downloading compilers...</span>
                        <span class="progress-subheading">Setting up compilers automatically. This process could take 3-5 minutes on first run.</span>
                      </div>

                      <div class="stepper-container" style="max-width: 320px;">
                        <div class="stepper-step" classList={{ active: installStep() === 1, completed: installStep() > 1 }}>
                          <div class="step-indicator">1</div>
                          <div class="step-title">Downloading Node.js</div>
                        </div>
                        <div class="stepper-step" classList={{ active: installStep() === 2, completed: installStep() > 2 }}>
                          <div class="step-indicator">2</div>
                          <div class="step-title">Downloading & installing Rustup</div>
                        </div>
                        <div class="stepper-step" classList={{ active: installStep() === 3, completed: installStep() > 3 }}>
                          <div class="step-indicator">3</div>
                          <div class="step-title">Registering PATH paths</div>
                        </div>
                      </div>
                    </div>
                  </Show>

                  <Show when={installState() !== "running" && installState() !== "idle"}>
                    <div style="margin-top: 1rem; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                      <Show when={installState() === "done"}>
                        <div style="background-color: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.15); border-radius: 6px; padding: 0.75rem; color: #10b981; font-size: 0.75rem; width: 100%; display: flex; align-items: center; gap: 0.5rem;">
                          <CheckCircle2 size={16} />
                          <div>
                            <div style="font-weight: 600;">System Toolchain Registered!</div>
                            <div style="font-size: 0.7rem; opacity: 0.8;">Restart wapp and scan environment requirements above to finish.</div>
                          </div>
                        </div>
                      </Show>

                      <Show when={installState() === "error"}>
                        <div style="background-color: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); border-radius: 6px; padding: 0.75rem; color: #f87171; font-size: 0.75rem; width: 100%; display: flex; align-items: center; gap: 0.5rem;">
                          <XCircle size={16} />
                          <div>
                            <div style="font-weight: 600;">Setup Encountered a Problem</div>
                            <div style="font-size: 0.7rem; opacity: 0.8;">Check the logs below. Active network connection or admin rights may be required.</div>
                          </div>
                        </div>
                      </Show>
                    </div>
                  </Show>

                  {/* Technical Logs Toggle for Setup */}
                  <Show when={installState() !== "idle"}>
                    <div style="text-align: center; margin-top: 0.5rem;">
                      <button class="tech-logs-btn" onClick={() => setShowTechLogs(!showTechLogs())}>
                        {showTechLogs() ? "Hide setup console logs" : "View technical setup logs"}
                      </button>
                      <Show when={showTechLogs()}>
                        <div class="terminal-container" style="text-align: left; width: 100%;">
                          <div class="terminal-header">
                            <div class="terminal-dots">
                              <div class="terminal-dot red" />
                              <div class="terminal-dot yellow" />
                              <div class="terminal-dot green" />
                            </div>
                            <span>installer output logs</span>
                            <Terminal size={10} />
                          </div>
                          <div class="terminal-body" style="height: 120px; font-size: 0.75rem;">
                            <For each={installLogs()}>
                              {(log) => <div style="margin-bottom: 1px;">{log}</div>}
                            </For>
                          </div>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>
              </div>
            </Show>
          </div>
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
