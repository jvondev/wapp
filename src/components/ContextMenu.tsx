import { Component, For, onMount, onCleanup, createSignal } from "solid-js";

interface IconProps {
  size?: number | string;
  color?: string;
  [key: string]: any;
}

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  options: {
    label: string;
    icon: Component<IconProps>;
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

  // Safe positioning logic to avoid layout jump
  const [position, setPosition] = createSignal({ x: props.x, y: props.y, opacity: 0 });

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);

    if (menuRef) {
      const rect = menuRef.getBoundingClientRect();
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      let nextX = props.x;
      let nextY = props.y;

      if (props.x + rect.width > screenWidth) {
        nextX = screenWidth - rect.width - 10;
      }
      if (props.y + rect.height > screenHeight) {
        nextY = screenHeight - rect.height - 10;
      }

      setPosition({ x: nextX, y: nextY, opacity: 1 });
    }
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  return (
    <div
      ref={menuRef}
      class="context-menu"
      style={{
        position: "fixed",
        top: `${position().y}px`,
        left: `${position().x}px`,
        opacity: position().opacity,
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
