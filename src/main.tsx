import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DialogProvider } from "./components/Dialog";
import { loadSavedTheme } from "./lib/theme";

loadSavedTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DialogProvider>
      <App />
    </DialogProvider>
  </StrictMode>
);
