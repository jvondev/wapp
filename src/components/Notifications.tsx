import { Component, For } from "solid-js";
import { useAppStore } from "../store";
import { CheckCircle2, XCircle, Info, X } from "lucide-solid";

export const Notifications: Component = () => {
  const [state, actions] = useAppStore();

  return (
    <div class="notifications-container">
      <For each={state.notifications}>
        {(n) => (
          <div class={`notification-toast ${n.type}`}>
            <div class="notification-icon">
              {n.type === "success" && <CheckCircle2 size={16} />}
              {n.type === "error" && <XCircle size={16} />}
              {n.type === "info" && <Info size={16} />}
            </div>
            <div class="notification-message">{n.message}</div>
            <button class="notification-close" onClick={() => actions.removeNotification(n.id)}>
              <X size={14} />
            </button>
          </div>
        )}
      </For>
    </div>
  );
};
