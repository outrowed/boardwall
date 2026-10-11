import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [tailwindcss()],
    esbuild: { jsx: "automatic" },
    server: {
        allowedHosts: ["celery.tailf0d1c0.ts.net"],
        hmr: { clientPort: 8448 },
        proxy: { "/api": "http://127.0.0.1:3018" },
    },
});
