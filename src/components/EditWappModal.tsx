import { Component, Show, createSignal, createEffect } from "solid-js";
import { X, Save, Settings } from "lucide-solid";
import { useAppStore } from "../store";

export const EditWappModal: Component = () => {
  const [state, actions] = useAppStore();

  const [name, setName] = createSignal("");
  const [url, setUrl] = createSignal("");
  const [category, setCategory] = createSignal("Work");
  const [width, setWidth] = createSignal(1280);
  const [height, setHeight] = createSignal(800);
  const [hideTitle, setHideTitle] = createSignal(true);
  const [customIcon, setCustomIcon] = createSignal<string | null>(null);

  let fileInput: HTMLInputElement | undefined;

  // Sync state when editing wapp changes
  createEffect(() => {
    if (state.editingWapp) {
      setName(state.editingWapp.name);
      setUrl(state.editingWapp.url);
      setCategory(state.editingWapp.category);
      setWidth(state.editingWapp.width);
      setHeight(state.editingWapp.height);
      setHideTitle(state.editingWapp.hide_title_bar);
      setCustomIcon(state.editingWapp.icon || null);
    }
  });

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

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!state.editingWapp) return;
    
    actions.editWapp(state.editingWapp.id, {
      name: name(),
      url: url(),
      category: category(),
      width: width(),
      height: height(),
      hideTitle: hideTitle(),
    }, customIcon());
    
    actions.setEditingWapp(null);
  };

  return (
    <Show when={state.editingWapp}>
      <div class="command-center-overlay" onClick={() => actions.setEditingWapp(null)}>
        <div class="command-center-container" style="max-width: 500px;" onClick={(e) => e.stopPropagation()}>
          <div class="advanced-card fade-in" style="margin: 0; border: none; background: #18181b;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1rem;">
              <h3 style="font-size: 1rem; font-weight: 600; color: #fff; display: flex; align-items: center; gap: 0.5rem;">
                <Settings size={18} /> Edit Wapp
              </h3>
              <button class="btn-icon" onClick={() => actions.setEditingWapp(null)}><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit} style="display: flex; flex-direction: column; gap: 1rem;">
              <div class="advanced-field-group">
                <label>App Name</label>
                <input type="text" class="input-field" value={name()} onInput={(e) => setName(e.currentTarget.value)} required />
              </div>
              
              <div class="advanced-field-group">
                <label>URL</label>
                <input type="url" class="input-field" value={url()} onInput={(e) => setUrl(e.currentTarget.value)} required />
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="advanced-field-group">
                  <label>Category</label>
                  <select class="input-field" value={category()} onChange={(e) => setCategory(e.currentTarget.value)}>
                    <option value="All">All</option>
                    <option value="Work">Work</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
                <div class="advanced-field-group">
                  <label>Window Style</label>
                  <div style="display: flex; align-items: center; gap: 0.5rem; height: 100%; padding-left: 0.5rem;">
                    <input type="checkbox" checked={hideTitle()} onChange={(e) => setHideTitle(e.currentTarget.checked)} id="hideTitle" />
                    <label for="hideTitle" style="margin: 0; cursor: pointer;">Frameless Window</label>
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

              <div class="advanced-field-group" style="margin-bottom: 1rem;">
                <label>App Icon</label>
                <div style="display: flex; gap: 1rem; align-items: center; background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                  <div class="wapp-icon" style="width: 40px; height: 40px; flex-shrink: 0; font-size: 1.2rem; background: #27272a;">
                    <Show when={customIcon()} fallback={name().charAt(0) || "W"}>
                      <img src={customIcon()!} style="width: 100%; height: 100%; object-fit: contain; border-radius: 6px;" />
                    </Show>
                  </div>
                  <div style="flex: 1;">
                    <button type="button" class="btn-icon" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; background: rgba(255,255,255,0.05); width: auto;" onClick={() => fileInput?.click()}>
                      Upload New Icon
                    </button>
                    <input ref={fileInput} type="file" hidden accept="image/*" onInput={handleIconUpload} />
                  </div>
                  <Show when={customIcon()}>
                    <button type="button" class="btn-icon delete" onClick={() => setCustomIcon(null)} title="Remove Icon"><X size={14} /></button>
                  </Show>
                </div>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05);">
                <button type="button" class="btn-icon" onClick={() => actions.setEditingWapp(null)} style="padding: 0.5rem 1rem; width: auto;">Cancel</button>
                <button type="submit" class="btn-command" style="padding: 0.5rem 1.5rem; width: auto;">
                  <Save size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Show>
  );
};
