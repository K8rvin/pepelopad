import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  define: {
    __BUILD_ID__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) || "dev"),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "0.0.0"),
  },
});
