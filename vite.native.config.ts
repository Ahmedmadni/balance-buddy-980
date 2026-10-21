import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {resolve} from "node:path";
export default defineConfig({plugins:[react()],publicDir:"public",base:"/",build:{outDir:"dist/client",emptyOutDir:true,rollupOptions:{input:resolve("android-local.html")}}});
