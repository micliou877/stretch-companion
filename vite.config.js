import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" 使用相對路徑，GitHub Pages 專案站台 / Netlify / Vercel 皆可直接部署
export default defineConfig({
  base: "./",
  plugins: [react()],
});
