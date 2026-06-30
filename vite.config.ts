import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Cloudflare Pages はルート配信なので base は '/'
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      // React 本体を別チャンクに分離（アプリ更新時もブラウザキャッシュが効く）
      output: { manualChunks: { react: ["react", "react-dom"] } },
    },
  },
});
