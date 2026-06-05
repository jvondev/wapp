import { Component, Show, createSignal, For } from "solid-js";
import { Globe, Plus, Settings, X, Loader2, Play } from "lucide-solid";
import { useAppStore } from "../store";
import { tauriService } from "../services/tauri";

export const CommandCenter: Component = () => {
  const [state, actions] = useAppStore();

  const [showAdvanced, setShowAdvanced] = createSignal(false);
  const [url, setUrl] = createSignal("");
  const [name, setName] = createSignal("");
  const [category, setCategory] = createSignal("All");
  const [width, setWidth] = createSignal(1280);
  const [height, setHeight] = createSignal(800);
  const [hideTitle, setHideTitle] = createSignal(true);
  const [maximize, setMaximize] = createSignal(true);

  const [faviconUrl, setFaviconUrl] = createSignal("");
  const [isFetchingInfo, setIsFetchingInfo] = createSignal(false);
  const [previewBlocked, setPreviewBlocked] = createSignal(false);

  const isUrl = () => url().includes(".") && url().length > 3;

  const filteredExistingWapps = () => {
    if (isUrl() || url() === "") return [];
    return state.wapps.filter(w => 
      w.name.toLowerCase().includes(url().toLowerCase()) || 
      w.url.toLowerCase().includes(url().toLowerCase())
    ).slice(0, 5);
  };

  const fetchSiteInfo = async (urlVal: string) => {
    if (!urlVal.includes(".") || urlVal.length < 4) return;
    setIsFetchingInfo(true);
    setPreviewBlocked(false);
    try {
      const info = await tauriService.getSiteInfo(urlVal);
      if (info.icon) setFaviconUrl(info.icon);
      if (info.title && !name()) {
        let cleanTitle = info.title.split(/ - | \| |: /)[0].trim();
        setName(cleanTitle);
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
    setUrl(val);
    if (val.includes(".")) {
      const cleanUrl = val.startsWith("http") ? val : `https://${val}`;
      setFaviconUrl(`https://www.google.com/s2/favicons?domain=${cleanUrl}&sz=128`);
    }
  };

  const autoFillName = () => {
    let urlVal = url().trim();
    if (!urlVal || !urlVal.includes(".")) return;
    if (!urlVal.startsWith("http://") && !urlVal.startsWith("https://")) {
      urlVal = "https://" + urlVal;
      setUrl(urlVal);
    }
    if (name()) return;
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
    }, faviconUrl());

    setUrl("");
    setName("");
    setFaviconUrl("");
  };

  return (
    <Show when={state.showAddModal}>
      <div class="command-center-overlay" onClick={() => actions.setShowAddModal(false)}>
        <div class="command-center-container" onClick={(e) => e.stopPropagation()}>
          
          <Show when={isUrl()}>
            <div class="floating-preview">
              <div class="preview-top-bar">
                <Show when={faviconUrl()} fallback={<div class="wapp-icon" style="width: 20px; height: 20px; font-size: 0.6rem; border-radius: 4px;">{name().charAt(0) || "W"}</div>}>
                  <img src={faviconUrl()} class="preview-favicon" />
                </Show>
                <div class="wapp-info" style="gap: 0;">
                  <span class="wapp-name" style="font-size: 0.8rem;">
                     {isFetchingInfo() ? "Fetching site info..." : (name() || "Preview")}
                  </span>
                  <span class="wapp-url" style="font-size: 0.6rem;">{url()}</span>
                </div>
                <div style="margin-left: auto; display: flex; gap: 0.5rem; align-items: center;">
                   {isFetchingInfo() && <Loader2 size={12} class="loading-spinner" />}
                   <button class="btn-icon" title="Settings" onClick={() => setShowAdvanced(!showAdvanced())}>
                      <Settings size={14} />
                   </button>
                </div>
              </div>
              
              <Show when={!previewBlocked()} fallback={
                <div style="height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; background: #09090b; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
                   <Globe size={32} style="color: #27272a" />
                   <span style="font-size: 0.75rem; color: #52525b;">Secure site (Preview blocked by website)</span>
                </div>
              }>
                <iframe 
                  src={url().startsWith("http") ? url() : `https://${url()}`} 
                  class="interactive-viewport"
                  title="Wapp Preview"
                  onLoad={() => {
                    // Simple heuristic: if it loads extremely fast and empty, it might be blocked
                  }}
                />
              </Show>
            </div>
          </Show>

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
                onBlur={() => { autoFillName(); fetchSiteInfo(url()); }}
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

          {/* Search Results for Existing Wapps */}
          <Show when={filteredExistingWapps().length > 0}>
             <div class="search-results">
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
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                />
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
        </div>
      </div>
    </Show>
  );
};
