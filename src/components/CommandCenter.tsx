import { Component, Show, createSignal } from "solid-js";
import { Globe, Plus, Settings, X, Loader2 } from "lucide-solid";

interface CommandCenterProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    url: string;
    category: string;
    width: number;
    height: number;
    hideTitle: boolean;
    maximize: boolean;
  }) => void;
  faviconUrl: string;
  isFetchingInfo: boolean;
  formUrl: string;
  onUrlInput: (val: string) => void;
  onUrlBlur: () => void;
  formName: string;
  onNameInput: (val: string) => void;
}

export const CommandCenter: Component<CommandCenterProps> = (props) => {
  const [showAdvanced, setShowAdvanced] = createSignal(false);
  const [category, setCategory] = createSignal("All");
  const [width, setWidth] = createSignal(1280);
  const [height, setHeight] = createSignal(800);
  const [hideTitle, setHideTitle] = createSignal(true);
  const [maximize, setMaximize] = createSignal(true);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    props.onSubmit({
      name: props.formName,
      url: props.formUrl,
      category: category(),
      width: width(),
      height: height(),
      hideTitle: hideTitle(),
      maximize: maximize()
    });
  };

  return (
    <Show when={props.show}>
      <div class="command-center-overlay" onClick={props.onClose}>
        <div class="command-center-container" onClick={(e) => e.stopPropagation()}>
          
          {/* Live Interactive Preview */}
          <Show when={props.formUrl.length > 3 && props.formUrl.includes(".")}>
            <div class="floating-preview">
              <div class="preview-top-bar">
                <Show when={props.faviconUrl} fallback={<div class="wapp-icon" style="width: 20px; height: 20px; font-size: 0.6rem; border-radius: 4px;">{props.formName.charAt(0) || "W"}</div>}>
                  <img src={props.faviconUrl} class="preview-favicon" />
                </Show>
                <div class="wapp-info" style="gap: 0;">
                  <span class="wapp-name" style="font-size: 0.8rem;">
                     {props.isFetchingInfo ? "Fetching site info..." : (props.formName || "Preview")}
                  </span>
                  <span class="preview-app-meta" style="font-size: 0.6rem;">{props.formUrl}</span>
                </div>
                <div style="margin-left: auto; display: flex; gap: 0.5rem; align-items: center;">
                   {props.isFetchingInfo && <Loader2 size={12} class="loading-spinner" />}
                   <button class="btn-icon" title="Settings" onClick={() => setShowAdvanced(!showAdvanced())}>
                      <Settings size={14} />
                   </button>
                </div>
              </div>
              <iframe 
                src={props.formUrl.startsWith("http") ? props.formUrl : `https://${props.formUrl}`} 
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
                value={props.formUrl}
                onInput={(e) => props.onUrlInput(e.currentTarget.value)}
                onBlur={props.onUrlBlur}
              />
              <button 
                type="submit" 
                class="btn-command"
                style="padding: 0.6rem 1.25rem; font-size: 0.85rem;"
                disabled={!props.formUrl || !props.formName}
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
                  value={props.formName}
                  onInput={(e) => props.onNameInput(e.currentTarget.value)}
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
