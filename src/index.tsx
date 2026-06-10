import { render } from "solid-js/web";
import App from "./App";
import { AppStoreProvider, useAppStore } from "./store";

const StoreExposer = (props: { children: any }) => {
  const store = useAppStore();
  (window as any).__WAPP_STORE__ = store;
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
