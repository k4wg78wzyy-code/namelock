import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// On GitHub Pages project sites the app is served from /<repo-name>/.
// The deploy workflow sets VITE_BASE automatically; locally it defaults to "/".
const base = process.env.VITE_BASE || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "NameLock — Name Memory Trainer",
        short_name: "NameLock",
        description: "Lock names into memory by linking name syllables to facial features.",
        theme_color: "#ff6b35",
        background_color: "#0f0c09",
        display: "standalone",
        orientation: "portrait",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        // Cache the app shell so it opens offline. API calls always hit the network.
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"]
      }
    })
  ]
});
