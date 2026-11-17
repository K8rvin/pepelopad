import { defineConfig } from "vite";
import { resolve } from "node:path";

export function formatLocalBuildDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default defineConfig({
  base: "./",
  server: {
    watch: {
      ignored: ["**/.cache/**", "**/assets-src/**"],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        city: resolve(__dirname, "city.html"),
      },
    },
  },
  define: {
    __BUILD_ID__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) || "dev"),
    __BUILD_DATE__: JSON.stringify(formatLocalBuildDate()),
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "0.0.0"),
  },
});
