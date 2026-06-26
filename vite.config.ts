import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Cloudflare Pages はルート配信なので base は '/'
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
  },
});
