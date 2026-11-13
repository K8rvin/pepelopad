import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  define: {
    __BUILD_ID__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) || "dev"),
  },
});
