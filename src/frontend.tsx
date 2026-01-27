import { type Root, createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { App } from "./app/App";

function getRootElement(): HTMLElement {
  const el = document.getElementById("root");
  if (!el) {
    throw new Error("Root element not found");
  }
  return el;
}

const rootDiv = getRootElement();

const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

function getOrCreateRoot(): Root {
  const hot = import.meta.hot as { data: { root?: Root } } | undefined;
  if (hot) {
    // With hot module reloading, `import.meta.hot.data` is persisted.
    const existing = hot.data.root;
    if (existing) {
      return existing;
    }
    const newRoot = createRoot(rootDiv);
    hot.data.root = newRoot;
    return newRoot;
  }
  // The hot module reloading API is not available in production.
  return createRoot(rootDiv);
}

getOrCreateRoot().render(app);
