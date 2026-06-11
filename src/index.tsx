/**
 * Entry point for the Wapp desktop application.
 * Initializes the SolidJS app and provides the global store context.
 */
import { render } from "solid-js/web";
import App from "./App";
import { AppStoreProvider, useAppStore } from "./store";
import { JSX } from "solid-js";

const StoreExposer = (props: { children: JSX.Element }) => {
  const store = useAppStore();
  // Safe exposure for debugging
  Object.defineProperty(window, "__WAPP_STORE__", {
    value: store,
    configurable: true,
    enumerable: false,
    writable: true,
  });
  return props.children;
};

const root = document.getElementById("root");

if (root) {
  render(
    () => (
      <AppStoreProvider>
        <StoreExposer>
          <App />
        </StoreExposer>
      </AppStoreProvider>
    ),
    root,
  );
}
