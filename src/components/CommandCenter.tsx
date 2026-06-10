import { Component, Show, createSignal, For, onMount, onCleanup, createEffect } from "solid-js";
import { Plus, Settings, X, Play, Minus, Square, Command } from "lucide-solid";
import { useAppStore } from "../store";
import { tauriService } from "../services/tauri";

export const CommandCenter: Component = () => {
  const [state, actions] = useAppStore();

  const [showAdvanced, setShowAdvanced] = createSignal(false);
  const [url, setUrl] = createSignal("");
  const [name, setName] = createSignal("");
  const [isNameManuallyEdited, setIsNameManuallyEdited] = createSignal(false);
  const [category, setCategory] = createSignal("All");
  const [width, setWidth] = createSignal(1280);
  const [height, setHeight] = createSignal(800);
  const [hideTitle, setHideTitle] = createSignal(false);
  const [maximize, setMaximize] = createSignal(true);

  const [faviconUrl, setFaviconUrl] = createSignal("");
  const [customIcon, setCustomIcon] = createSignal<string | null>(null);
  const [isFetchingInfo, setIsFetchingInfo] = createSignal(false);
  const [showPreview, setShowPreview] = createSignal(false);

  const safeParse = (key: string, defaultVal: string[]) => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultVal;
      const parsed = JSON.parse(item);
      return Array.isArray(parsed) ? parsed : defaultVal;
    } catch {
      return defaultVal;
    }
  };

  const defaultOs = safeParse("wapp_prefs_os", ["windows"]);

  const [targetOs, setTargetOs] = createSignal<string[]>(defaultOs);

  const toggleOs = (os: string) => {
    let current = targetOs();
    let next = current.includes(os) ? current.filter(o => o !== os) : [...current, os];
    if (next.length === 0) next = [os];
    setTargetOs(next);
    localStorage.setItem("wapp_prefs_os", JSON.stringify(next));
  };

  const headerOsStyle = () => {
    const os = targetOs();
    if (os.includes("windows")) return "windows";
    if (os.length > 0) return os[0];
    return "windows";
  };

  let previewPlaceholder: HTMLDivElement | undefined;
  let debounceTimer: number | undefined;
  let fileInput: HTMLInputElement | undefined;

  const isUrl = () => url().includes(".") && url().length > 3;

  const getEffectiveIcon = () => customIcon() || faviconUrl();

  const handleIconUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (prev) => {
        setCustomIcon(prev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredExistingWapps = () => {
    if (isUrl() || url() === "") return [];
    return state.wapps.filter(w =>
      w.name.toLowerCase().includes(url().toLowerCase()) ||
      w.url.toLowerCase().includes(url().toLowerCase())
    ).slice(0, 5);
  };

  const syncPreviewPosition = () => {
    if (!previewPlaceholder || !showPreview() || showAdvanced()) return;
    const rect = previewPlaceholder.getBoundingClientRect();
    tauriService.updatePreviewBounds({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    });
  };

  // Close preview when modal closes
  createEffect(() => {
    if (!state.showAddModal) {
      setShowPreview(false);
      setShowAdvanced(false);
      tauriService.closePreview();
    }
  });

  // Open/Update preview when it becomes visible
  createEffect(() => {
    if (showPreview() && previewPlaceholder && isUrl() && !showAdvanced()) {
      const rect = previewPlaceholder.getBoundingClientRect();
      const targetUrl = url().startsWith("http") ? url() : `https://${url()}`;
      tauriService.openPreview({
        url: targetUrl,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      });
    } else {
      tauriService.closePreview();
    }
  });

  const fetchSiteInfo = async (urlVal: string) => {
    if (!urlVal.includes(".") || urlVal.length < 4) {
      setShowPreview(false);
      return;
    }
    setIsFetchingInfo(true);

    try {
      const info = await tauriService.getSiteInfo(urlVal);
      if (info.icon) setFaviconUrl(info.icon);
      if (info.title && !isNameManuallyEdited()) {
        let cleanTitle = info.title.split(/ - | \| |: /)[0].trim();
        setName(cleanTitle);
      }
      setShowPreview(true);
    } catch (err) {
      console.error("Failed to fetch site info:", err);
      const cleanUrl = urlVal.startsWith("http") ? urlVal : `https://${urlVal}`;
      setFaviconUrl(`https://www.google.com/s2/favicons?domain=${cleanUrl}&sz=128`);
      setShowPreview(true);
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const handleUrlChange = (val: string) => {
    setUrl(val);
    if (debounceTimer) clearTimeout(debounceTimer);

    if (val.includes(".")) {
      const cleanUrl = val.startsWith("http") ? val : `https://${val}`;
      setFaviconUrl(`https://www.google.com/s2/favicons?domain=${cleanUrl}&sz=128`);

      debounceTimer = window.setTimeout(() => {
        autoFillName();
        fetchSiteInfo(val);
      }, 600);
    } else {
      setShowPreview(false);
    }
  };

  const autoFillName = () => {
    if (isNameManuallyEdited()) return;
    let urlVal = url().trim();
    if (!urlVal || !urlVal.includes(".")) return;
    if (!urlVal.startsWith("http://") && !urlVal.startsWith("https://")) {
      urlVal = "https://" + urlVal;
    }
    try {
      const parsed = new URL(urlVal);
      const parts = parsed.hostname.replace("www.", "").split(".");
      if (parts.length >= 2) {
        let brand = parts[parts.length - 2];
        brand = brand.charAt(0).toUpperCase() + brand.slice(1);
        if (parts.length > 2) {
          const sub = parts[0].toLowerCase();
          const commonAppSubs = ["app", "web", "my", "dashboard", "console", "portal", "cloud"];
          if (commonAppSubs.includes(sub)) setName(`${brand} App`);
          else setName(`${sub.charAt(0).toUpperCase() + sub.slice(1)} ${brand}`);
        } else setName(brand);
      }
    } catch (_) { }
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!isUrl()) return;
    const normalizedUrl = url().startsWith("http") ? url() : `https://${url()}`;
    actions.startBuild({
      name: name(),
      url: normalizedUrl,
      category: category(),
      width: width(),
      height: height(),
      hideTitle: hideTitle(),
      maximize: maximize(),
      os: targetOs()
    }, getEffectiveIcon());

    setUrl("");
    setName("");
    setIsNameManuallyEdited(false);
    setFaviconUrl("");
    setCustomIcon(null);
    setShowPreview(false);
    setShowAdvanced(false);
  };

  onMount(() => {
    const observer = new ResizeObserver(() => syncPreviewPosition());
    window.addEventListener("resize", syncPreviewPosition);

    const timer = setInterval(() => {
      if (previewPlaceholder) {
        observer.observe(previewPlaceholder);
        clearInterval(timer);
      }
    }, 100);

    onCleanup(() => {
      observer.disconnect();
      window.removeEventListener("resize", syncPreviewPosition);
      clearInterval(timer);
      if (debounceTimer) clearTimeout(debounceTimer);
    });
  });

  return (
    <Show when={state.showAddModal}>
      <div class="command-center-overlay" onClick={() => actions.setShowAddModal(false)}>
        <div class="command-center-container" onClick={(e) => e.stopPropagation()}>

          <div style="position: relative;">
            <form onSubmit={handleSubmit} class="command-bar">
              <Command size={22} style="color: hsl(var(--muted-foreground))" />
              <input
                autofocus
                type="text"
                class="command-input"
                placeholder="Search apps or paste a URL..."
                value={url()}
                onInput={(e) => handleUrlChange(e.currentTarget.value)}
              />
              <Show when={!isUrl()}>
                <div class="kbd-shortcut" style="padding: 0.3rem 0.6rem; border-radius: 8px; background: hsl(var(--muted) / 0.8); border: 1px solid hsl(var(--border) / 0.5); font-size: 0.75rem; color: hsl(var(--muted-foreground));">
                  <kbd>⌘</kbd> <kbd>K</kbd>
                </div>
              </Show>
              <Show when={isUrl()}>
                <div style="display: flex; gap: 0.75rem; align-items: center;">
                  <button
                    type="button"
                    class="btn-icon"
                    style="border: none; background: hsl(var(--accent)); width: 38px; height: 38px; border-radius: 10px;"
                    onClick={() => setShowAdvanced(!showAdvanced())}
                    title="Advanced Configuration"
                  >
                    <Settings size={20} />
                  </button>
                  <button
                    type="submit"
                    class="btn-primary"
                    style="height: 38px; padding: 0 1.25rem; border-radius: 10px; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;"
                    disabled={!url() || !name()}
                  >
                    <Plus size={18} />
                    Create
                  </button>
                </div>
              </Show>
            </form>
          </div>

          <div class="command-center-content transition-group">
            <Show when={showAdvanced()}>
              <div class="advanced-card fade-in">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                  <h3 style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; color: hsl(var(--foreground)); letter-spacing: 0.05em;">Configuration</h3>
                  <button class="btn-icon" style="border: none;" onClick={() => setShowAdvanced(false)}><X size={16} /></button>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                  <div class="advanced-field-group">
                    <label style="font-size: 0.65rem; margin-bottom: 0.4rem;">Application Name</label>
                    <input
                      type="text"
                      class="input-field"
                      placeholder="e.g. Todoist App"
                      value={name()}
                      onInput={(e) => { setName(e.currentTarget.value); setIsNameManuallyEdited(true); }}
                    />
                  </div>
                  <div class="advanced-field-group">
                    <label style="font-size: 0.65rem; margin-bottom: 0.4rem;">App Icon</label>
                    <div style="display: flex; gap: 0.75rem; align-items: center;">
                      <div class="wapp-icon-container" style="width: 42px; height: 42px; border-radius: 10px; flex-shrink: 0; box-shadow: none;">
                        <Show when={getEffectiveIcon()} fallback={<span style="font-weight: 700;">{name().charAt(0) || "W"}</span>}>
                          <img src={getEffectiveIcon()} style="width: 100%; height: 100%; object-fit: contain; padding: 0.4rem;" />
                        </Show>
                      </div>
                      <button class="btn-icon" style="flex: 1; height: 42px; font-size: 0.75rem; font-weight: 600; border-radius: 10px;" onClick={() => fileInput?.click()}>
                        {customIcon() ? "Change Icon" : "Upload Custom"}
                      </button>
                      <input ref={fileInput} type="file" hidden accept="image/*" onInput={handleIconUpload} />
                      <Show when={customIcon()}>
                        <button class="btn-icon" style="border-color: rgba(239, 68, 68, 0.2); color: #ef4444;" onClick={() => setCustomIcon(null)}><X size={14} /></button>
                      </Show>
                    </div>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.5rem;">
                  <div class="advanced-field-group">
                    <label style="font-size: 0.65rem; margin-bottom: 0.4rem;">Category</label>
                    <select
                      class="input-field"
                      value={category()}
                      onChange={(e) => setCategory(e.currentTarget.value)}
                    >
                      <option value="All">All</option>
                      <option value="Work">Work</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div class="advanced-field-group">
                    <label style="font-size: 0.65rem; margin-bottom: 0.4rem;">Window Style</label>
                    <div style="display: flex; align-items: center; gap: 1.5rem; height: 100%;">
                      <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer; text-transform: none; letter-spacing: normal;">
                        <input type="checkbox" checked={hideTitle()} onChange={(e) => setHideTitle(e.currentTarget.checked)} style="accent-color: hsl(var(--primary));" />
                        <span style="font-size: 0.85rem; font-weight: 500; color: hsl(var(--foreground));">Frameless</span>
                      </label>
                      <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer; text-transform: none; letter-spacing: normal;">
                        <input type="checkbox" checked={maximize()} onChange={(e) => setMaximize(e.currentTarget.checked)} style="accent-color: hsl(var(--primary));" />
                        <span style="font-size: 0.85rem; font-weight: 500; color: hsl(var(--foreground));">Maximize</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.5rem;">
                  <div class="advanced-field-group">
                    <label style="font-size: 0.65rem; margin-bottom: 0.4rem;">Width (px)</label>
                    <input type="number" class="input-field" value={width()} onInput={(e) => setWidth(parseInt(e.currentTarget.value))} />
                  </div>
                  <div class="advanced-field-group">
                    <label style="font-size: 0.65rem; margin-bottom: 0.4rem;">Height (px)</label>
                    <input type="number" class="input-field" value={height()} onInput={(e) => setHeight(parseInt(e.currentTarget.value))} />
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr; gap: 1rem; margin-top: 1.5rem;">
                  <div class="advanced-field-group">
                    <label style="font-size: 0.65rem; margin-bottom: 0.6rem;">Target OS Platforms</label>
                    <div class="pill-group" style="gap: 0.75rem;">
                      <button type="button" class="pill-btn" classList={{ active: targetOs().includes('windows') }} onClick={() => toggleOs('windows')} style="padding: 0.5rem 1rem; border-radius: 10px;">Windows (.exe)</button>
                      <button type="button" class="pill-btn" classList={{ active: targetOs().includes('mac') }} onClick={() => toggleOs('mac')} style="padding: 0.5rem 1rem; border-radius: 10px;">macOS (.app)</button>
                      <button type="button" class="pill-btn" classList={{ active: targetOs().includes('linux') }} onClick={() => toggleOs('linux')} style="padding: 0.5rem 1rem; border-radius: 10px;">Linux (Binary)</button>
                    </div>
                  </div>
                </div>
              </div>
            </Show>

            <Show when={!showAdvanced() && isUrl() && (showPreview() || isFetchingInfo())}>
              <div class="app-window-preview fade-in">
                <div class="app-window-header" style="height: 48px; padding: 0 1.25rem;" classList={{ "windows-header": headerOsStyle() !== "mac" }}>
                  <Show when={headerOsStyle() === "mac"}>
                    <div class="window-controls mac" style="gap: 10px;">
                      <div class="control close" style="width: 14px; height: 14px;" />
                      <div class="control minimize" style="width: 14px; height: 14px;" />
                      <div class="control maximize" style="width: 14px; height: 14px;" />
                    </div>
                  </Show>
                  <div class="window-title" style={headerOsStyle() !== "mac" ? "margin-right: auto;" : ""}>
                    <Show when={getEffectiveIcon()} fallback={<div class="wapp-icon-container" style="width: 18px; height: 18px; font-size: 0.6rem; border-radius: 4px; box-shadow: none;">{name().charAt(0) || "W"}</div>}>
                      <img src={getEffectiveIcon()} class="preview-favicon" style="width: 18px; height: 18px;" />
                    </Show>
                    <span style="font-weight: 600; font-size: 0.85rem;">{name() || "New Wapp"}</span>
                  </div>
                  <div style="margin-left: auto; display: flex; align-items: stretch; height: 100%;">
                    <Show when={headerOsStyle() !== "mac"}>
                      <div class="window-controls windows">
                        <div class="win-control win-minimize"><Minus size={16} /></div>
                        <div class="win-control win-maximize"><Square size={12} /></div>
                        <div class="win-control win-close" style="width: 52px;"><X size={18} /></div>
                      </div>
                    </Show>
                  </div>
                </div>

                <div
                  ref={previewPlaceholder}
                  class="interactive-viewport"
                  style="background: #09090b; height: 480px;"
                />
              </div>
            </Show>

            <Show when={!showAdvanced() && filteredExistingWapps().length > 0}>
              <div class="search-results fade-in" style="border-radius: 18px; border: 1px solid hsl(var(--border)); padding: 0.5rem;">
                <div style="padding: 0.75rem 1rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: hsl(var(--muted-foreground)); letter-spacing: 0.05em;">Already Created</div>
                <For each={filteredExistingWapps()}>
                  {(wapp) => (
                    <div class="search-item" style="border: none; border-radius: 12px; margin-bottom: 2px; padding: 0.875rem 1rem;" onClick={() => { tauriService.launchWapp(wapp.path); actions.setShowAddModal(false); }}>
                      <div class="wapp-icon-container" style="width: 32px; height: 32px; font-size: 0.8rem; box-shadow: none; border-radius: 8px;">{wapp.name.charAt(0)}</div>
                      <div class="search-item-info" style="gap: 0.125rem;">
                        <span class="search-item-name" style="font-weight: 600;">{wapp.name}</span>
                        <span class="search-item-url" style="opacity: 0.7;">{wapp.url}</span>
                      </div>
                      <div style="margin-left: auto; opacity: 0.5;"><Play size={14} fill="currentColor" /></div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>

  );
};
