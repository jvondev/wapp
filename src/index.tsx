import { render } from "solid-js/web";
import App from "./App";
import { AppStoreProvider } from "./store";

const root = document.getElementById("root");

if (root) {
  render(() => (
    <AppStoreProvider>
      <App />
    </AppStoreProvider>
  ), root);
}
