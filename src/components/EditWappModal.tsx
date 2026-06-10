import { Component, Show, createSignal, createEffect } from "solid-js";
import { X, Save, Pencil } from "lucide-solid";
import { useAppStore } from "../store";

export const EditWappModal: Component = () => {
  const [state, actions] = useAppStore();

  const [name, setName] = createSignal("");
  const [url, setUrl] = createSignal("");
  const [category, setCategory] = createSignal("Work");
  const [width, setWidth] = createSignal(1280);
  const [height, setHeight] = createSignal(800);
  const [hideTitle, setHideTitle] = createSignal(false);
  const [maximize, setMaximize] = createSignal(true);
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
      setMaximize(state.editingWapp.maximize);
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
      maximize: maximize(),
    }, customIcon());
    
    actions.setEditingWapp(null);
  };

  return (
    <Show when={state.editingWapp}>
      <div class="command-center-overlay" onClick={() => actions.setEditingWapp(null)}>
        <div class="command-center-container" style="max-width: 520px;" onClick={(e) => e.stopPropagation()}>
          <div class="advanced-card fade-in" style="margin: 0; padding: 2rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
              <h3 style="font-size: 1.1rem; font-weight: 700; color: hsl(var(--foreground)); display: flex; align-items: center; gap: 0.75rem;">
                <div style="background: hsl(var(--accent)); padding: 0.5rem; border-radius: 10px; color: hsl(var(--primary));"><Pencil size={20} /></div>
                Edit Application
              </h3>
              <button class="btn-icon" style="border: none;" onClick={() => actions.setEditingWapp(null)}><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} style="display: flex; flex-direction: column; gap: 1.5rem;">
              <div style="display: flex; gap: 1.5rem; align-items: center; background: hsl(var(--muted) / 0.3); padding: 1.25rem; border-radius: 16px; border: 1px solid hsl(var(--border));">
                <div class="wapp-icon-container" style="width: 64px; height: 64px; border-radius: 16px; flex-shrink: 0; box-shadow: none; font-size: 1.5rem;">
                  <Show when={customIcon()} fallback={name().charAt(0) || "W"}>
                    <img src={customIcon() ?? undefined} style="width: 100%; height: 100%; object-fit: contain; padding: 0.6rem;" />
                  </Show>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem;">
                  <span style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: hsl(var(--muted-foreground)); letter-spacing: 0.05em;">Visual Identity</span>
                  <button type="button" class="btn-icon" style="font-size: 0.8rem; padding: 0 1rem; background: hsl(var(--background)); width: auto; height: 32px; border-radius: 8px; font-weight: 600;" onClick={() => fileInput?.click()}>
                    Change Icon
                  </button>
                  <input ref={fileInput} type="file" hidden accept="image/*" onInput={handleIconUpload} />
                </div>
              </div>

              <div class="advanced-field-group">
                <label style="font-size: 0.65rem; margin-bottom: 0.4rem;">Application Name</label>
                <input type="text" class="input-field" value={name()} onInput={(e) => setName(e.currentTarget.value)} required />
              </div>

              <div class="advanced-field-group">
                <label style="font-size: 0.65rem; margin-bottom: 0.4rem;">Source URL</label>
                <input type="url" class="input-field" value={url()} onInput={(e) => setUrl(e.currentTarget.value)} required />
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                <div class="advanced-field-group">
                  <label style="font-size: 0.65rem; margin-bottom: 0.4rem;">Category</label>
                  <select class="input-field" value={category()} onChange={(e) => setCategory(e.currentTarget.value)}>
                    <option value="All">All</option>
                    <option value="Work">Work</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
                <div class="advanced-field-group">
                  <label style="font-size: 0.65rem; margin-bottom: 0.4rem;">Window Experience</label>
                  <div style="display: flex; align-items: center; gap: 1rem; height: 100%;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; text-transform: none; letter-spacing: normal;">
                      <input type="checkbox" checked={hideTitle()} onChange={(e) => setHideTitle(e.currentTarget.checked)} style="accent-color: hsl(var(--primary));" />
                      <span style="font-size: 0.8rem; font-weight: 500;">Frameless</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; text-transform: none; letter-spacing: normal;">
                      <input type="checkbox" checked={maximize()} onChange={(e) => setMaximize(e.currentTarget.checked)} style="accent-color: hsl(var(--primary));" />
                      <span style="font-size: 0.8rem; font-weight: 500;">Maximize</span>
                    </label>
                  </div>
                </div>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid hsl(var(--border));">
                <button type="button" class="btn-icon" onClick={() => actions.setEditingWapp(null)} style="padding: 0 1.25rem; width: auto; height: 42px; border-radius: 12px; font-weight: 600; border: none;">Discard</button>
                <button type="submit" class="btn-primary" style="height: 42px; padding: 0 2rem; border-radius: 12px; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                  <Save size={18} /> Update Wapp
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Show>
  );
};
