// SPDX-FileCopyrightText: © 2017 EteSync Authors
// SPDX-License-Identifier: AGPL-3.0-only

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Set PUBLIC_URL to serve the app from a subdirectory, e.g. PUBLIC_URL=/subdir-name
  base: process.env.PUBLIC_URL ?? "/",
  // REACT_APP_ is kept so existing build setups (e.g. REACT_APP_DEFAULT_API_PATH) keep working
  envPrefix: ["VITE_", "REACT_APP_"],
  plugins: [react()],
  build: {
    outDir: "build",
    sourcemap: true,
    // The app is a single bundle, most of which are the time zones and libraries
    chunkSizeWarningLimit: 3000,
    rolldownOptions: {
      onLog(level, log, handler) {
        // react-virtualized has a leftover directive of its own build, which doesn't matter
        if (log.code === "MODULE_LEVEL_DIRECTIVE" && log.id?.includes("react-virtualized")) {
          return;
        }
        handler(level, log);
      },
    },
  },
  server: {
    port: 3000,
  },
  test: {
    environment: "jsdom",
  },
});
