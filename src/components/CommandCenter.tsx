import { Component, Show, createSignal } from "solid-js";
import { Globe, Plus, Settings, X, Loader2 } from "lucide-solid";
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

  const fetchSiteInfo = async (urlVal: string) => {
    if (!urlVal.includes(".") || urlVal.length < 4) return;
    setIsFetchingInfo(true);
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
    if (!urlVal) return;
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
    actions.startBuild({
      name: name(),
      url: url(),
      category: category(),
      width: width(),
      height: height(),
      hideTitle: hideTitle(),
      maximize: maximize()
    }, faviconUrl());

    // Reset local state
    setUrl("");
    setName("");
    setFaviconUrl("");
  };

  return (
    <Show when={state.showAddModal}>
      <div class="command-center-overlay" onClick={() => actions.setShowAddModal(false)}>
        <div class="command-center-container" onClick={(e) => e.stopPropagation()}>
          
          <Show when={url().length > 3 && url().includes(".")}>
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
              <iframe 
                src={url().startsWith("http") ? url() : `https://${url()}`} 
                class="interactive-viewport"
                title="Wapp Preview"
              />
            </div>
          </Show>

          <div style="position: relative;">
            <form onSubmit={handleSubmit} class="command-bar">
              <Globe size={24} style="color: #52525b" />
              <input 
                autoFocus
                type="text" 
                class="command-input" 
                placeholder="Paste URL (e.g. app.todoist.com)..." 
                value={url()}
                onInput={(e) => handleUrlChange(e.currentTarget.value)}
                onBlur={() => { autoFillName(); fetchSiteInfo(url()); }}
              />
              <button 
                type="submit" 
                class="btn-command"
                style="padding: 0.6rem 1.25rem; font-size: 0.85rem;"
                disabled={!url() || !name()}
              >
                <Plus size={16} />
                Create Wapp
              </button>
            </form>
          </div>

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
