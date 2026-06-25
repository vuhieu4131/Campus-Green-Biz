import { defineConfig } from "vite";
import ZaloMiniApp from "zmp-vite-plugin";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default () => {
  return defineConfig({
    root: "./src",
    base: "",
    plugins: [
      tsconfigPaths({
        root: path.resolve(__dirname, "./"),
      }),
      react(),
      ZaloMiniApp(),
    ],
    resolve: {
      alias: {
        "utils": path.resolve(__dirname, "./src/utils"),
        "types": path.resolve(__dirname, "./src/types"),
        "state": path.resolve(__dirname, "./src/state.ts"),
        "hooks": path.resolve(__dirname, "./src/hooks.ts"),
        "pages": path.resolve(__dirname, "./src/pages"),
        "components": path.resolve(__dirname, "./src/components"),
      },
    },
  });
};


