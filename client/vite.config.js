import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dns from "node:dns";

dns.setDefaultResultOrder("verbatim");

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
  server: {
    allowedHosts: [
      "www.palais-freitas.xyz",
      "palais-freitas.xyz",
      "website-4gnq.onrender.com",
      "www.website-4gnq.onrender.com",
    ],
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
