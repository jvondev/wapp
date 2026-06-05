import { Component, Show, createSignal, For, onMount, onCleanup, createEffect } from "solid-js";
import { Globe, Plus, Settings, X, Loader2, Play } from "lucide-solid";
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
  const [hideTitle, setHideTitle] = createSignal(true);
  const [maximize, setMaximize] = createSignal(true);

  const [faviconUrl, setFaviconUrl] = createSignal("");
  const [customIcon, setCustomIcon] = createSignal<string | null>(null);
  const [isFetchingInfo, setIsFetchingInfo] = createSignal(false);
  const [showPreview, setShowPreview] = createSignal(false);

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
    } catch (_) {}
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!isUrl()) return;
    actions.startBuild({
      name: name(),
      url: url(),
      category: category(),
      width: width(),
      height: height(),
      hideTitle: hideTitle(),
      maximize: maximize()
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
              <Globe size={24} style="color: #52525b" />
              <input 
                autoFocus
                type="text" 
                class="command-input" 
                placeholder="Paste URL or search apps..." 
                value={url()}
                onInput={(e) => handleUrlChange(e.currentTarget.value)}
              />
              <Show when={isUrl()}>
                <button 
                  type="submit" 
                  class="btn-command"
                  style="padding: 0.6rem 1.25rem; font-size: 0.85rem;"
                  disabled={!url() || !name()}
                >
                  <Plus size={16} />
                  Create Wapp
                </button>
              </Show>
            </form>
          </div>

          <div class="command-center-content transition-group">
            <Show when={showAdvanced()}>
              <div class="advanced-card fade-in">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                   <h3 style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: #52525b; letter-spacing: 0.05em;">Configuration</h3>
                   <button class="btn-icon" onClick={() => setShowAdvanced(false)}><X size={14} /></button>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                  <div class="advanced-field-group">
                    <label>Application Name</label>
                    <input 
                      type="text" 
                      class="input-field" 
                      placeholder="e.g. Todoist App" 
                      value={name()}
                      onInput={(e) => { setName(e.currentTarget.value); setIsNameManuallyEdited(true); }}
                    />
                  </div>
                  <div class="advanced-field-group">
                    <label>App Icon</label>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                       <div class="wapp-icon" style="width: 32px; height: 32px; flex-shrink: 0;">
                          <Show when={getEffectiveIcon()} fallback={name().charAt(0) || "W"}>
                             <img src={getEffectiveIcon()} style="width: 100%; height: 100%; object-fit: contain; border-radius: 4px;" />
                          </Show>
                       </div>
                       <button class="btn-icon" style="flex: 1; height: 32px; font-size: 0.65rem;" onClick={() => fileInput?.click()}>
                          {customIcon() ? "Change Icon" : "Upload Custom"}
                       </button>
                       <input ref={fileInput} type="file" hidden accept="image/*" onInput={handleIconUpload} />
                       <Show when={customIcon()}>
                          <button class="btn-icon delete" onClick={() => setCustomIcon(null)}><X size={12} /></button>
                       </Show>
                    </div>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                  <div class="advanced-field-group">
                    <label>Category</label>
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
                    <label>Window Style</label>
                    <div style="display: flex; align-items: center; gap: 1rem; height: 100%;">
                       <div style="display: flex; align-items: center; gap: 0.4rem;">
                          <input type="checkbox" checked={hideTitle()} onChange={(e) => setHideTitle(e.currentTarget.checked)} />
                          <span style="font-size: 0.75rem;">Frameless</span>
                       </div>
                       <div style="display: flex; align-items: center; gap: 0.4rem;">
                          <input type="checkbox" checked={maximize()} onChange={(e) => setMaximize(e.currentTarget.checked)} />
                          <span style="font-size: 0.75rem;">Maximize</span>
                       </div>
                    </div>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                   <div class="advanced-field-group">
                      <label>Width</label>
                      <input type="number" class="input-field" value={width()} onInput={(e) => setWidth(parseInt(e.currentTarget.value))} />
                   </div>
                   <div class="advanced-field-group">
                      <label>Height</label>
                      <input type="number" class="input-field" value={height()} onInput={(e) => setHeight(parseInt(e.currentTarget.value))} />
                   </div>
                </div>
              </div>
            </Show>

            <Show when={!showAdvanced() && isUrl() && (showPreview() || isFetchingInfo())}>
              <div class="app-window-preview fade-in">
                <div class="app-window-header">
                  <div class="window-controls">
                    <div class="control close" />
                    <div class="control minimize" />
                    <div class="control maximize" />
                  </div>
                  <div class="window-title">
                    <Show when={getEffectiveIcon()} fallback={<div class="wapp-icon" style="width: 14px; height: 14px; font-size: 0.5rem; border-radius: 2px;">{name().charAt(0) || "W"}</div>}>
                      <img src={getEffectiveIcon()} class="preview-favicon" style="width: 14px; height: 14px;" />
                    </Show>
                    <span>{name() || "New Wapp"}</span>
                  </div>
                  <div style="margin-left: auto;">
                     <button class="btn-icon ghost" title="Settings" onClick={() => setShowAdvanced(true)}>
                        <Settings size={14} />
                     </button>
                  </div>
                </div>
                
                <div 
                  ref={previewPlaceholder} 
                  class="interactive-viewport" 
                  style="background: #000; height: 320px;"
                />

                <div class="preview-status-bar">
                   <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <Show when={isFetchingInfo()}>
                         <Loader2 size={10} class="loading-spinner" />
                         <span>Syncing live data...</span>
                      </Show>
                      <Show when={!isFetchingInfo()}>
                         <div class="status-dot active" style="width: 4px; height: 4px;" />
                         <span>Ready to build</span>
                      </Show>
                   </div>
                   <div style="margin-left: auto; color: #52525b;">{url()}</div>
                </div>
              </div>
            </Show>

            <Show when={!showAdvanced() && filteredExistingWapps().length > 0}>
               <div class="search-results fade-in">
                  <div style="padding: 0.5rem 1rem; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: #52525b; border-bottom: 1px solid rgba(255,255,255,0.03);">Existing Applications</div>
                  <For each={filteredExistingWapps()}>
                    {(wapp) => (
                      <div class="search-item" onClick={() => { tauriService.launchWapp(wapp.path); actions.setShowAddModal(false); }}>
                        <div class="wapp-icon" style="width: 24px; height: 24px; font-size: 0.7rem;">{wapp.name.charAt(0)}</div>
                        <div class="search-item-info">
                          <span class="search-item-name">{wapp.name}</span>
                          <span class="search-item-url">{wapp.url}</span>
                        </div>
                        <div style="margin-left: auto;"><Play size={12} style="color: #52525b" /></div>
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
