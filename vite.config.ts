import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project site: https://usawrapco-spec.github.io/bubble-craps/
export default defineConfig({
  base: "/bubble-craps/",
  plugins: [react()],
  build: { target: "es2022", sourcemap: false },
});
