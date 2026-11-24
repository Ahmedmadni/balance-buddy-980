import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

/**
 * An entirely bundled static Capacitor application.
 * No TanStack SSR, Lovable hosted server, auth proxy, or Supabase dependency.
 */
export default defineConfig({
  root: resolve(process.cwd(), "native"),
  base: "./",
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: resolve(process.cwd(), "dist-native"),
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",
  },
});
