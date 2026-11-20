import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "tests/e2e/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/.git/**",
      "**/.cache/**",
      "**/.qwen/**", // worktrees — отдельные checkout'ы, не тесты корня
      "assets-src/**",
    ],
  },
});
