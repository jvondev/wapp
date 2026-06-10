import { render } from "solid-js/web";
import App from "./App";
import { AppStoreProvider, useAppStore } from "./store";
import { JSX } from "solid-js";

const StoreExposer = (props: { children: JSX.Element }) => {
  const store = useAppStore();
  (window as unknown as { __WAPP_STORE__: unknown }).__WAPP_STORE__ = store;
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
