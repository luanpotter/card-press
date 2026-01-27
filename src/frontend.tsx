import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "@/app/App";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Bun template: root element is guaranteed to exist
const rootDiv = document.getElementById("root")!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- required by Bun HMR API
if (import.meta.hot) {
  // With hot module reloading, `import.meta.hot.data` is persisted.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- required Bun HMR API
  const root = (import.meta.hot.data.root ??= createRoot(rootDiv)) as Root;
  root.render(app);
} else {
  // The hot module reloading API is not available in production.
  createRoot(rootDiv).render(app);
}
