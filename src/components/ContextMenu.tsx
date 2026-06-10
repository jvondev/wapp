import { Component, For, onMount, onCleanup, createEffect } from "solid-js";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  options: {
    label: string;
    icon: JSX.Element;
    onClick: () => void;
    variant?: "default" | "danger";
  }[];
}

export const ContextMenu: Component<ContextMenuProps> = (props) => {
  let menuRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (menuRef && !menuRef.contains(e.target as Node)) {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  createEffect(() => {
    // Adjust position if it goes off screen
    if (menuRef) {
      const rect = menuRef.getBoundingClientRect();
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      if (props.x + rect.width > screenWidth) {
        menuRef.style.left = `${screenWidth - rect.width - 10}px`;
      }
      if (props.y + rect.height > screenHeight) {
        menuRef.style.top = `${screenHeight - rect.height - 10}px`;
      }
    }
  });

  return (
    <div
      ref={menuRef}
      class="context-menu"
      style={{
        position: "fixed",
        top: `${props.y}px`,
        left: `${props.x}px`,
        "z-index": 1000,
      }}
    >
      <For each={props.options}>
        {(option) => (
          <button
            class="context-menu-item"
            classList={{ danger: option.variant === "danger" }}
            onClick={() => {
              option.onClick();
              props.onClose();
            }}
          >
            <option.icon size={14} />
            <span>{option.label}</span>
          </button>
        )}
      </For>
    </div>
  );
};
