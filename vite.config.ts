import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
    root: "src",
    build: {
        rollupOptions: {
            input: {
                popup: "src/popup.html",
            },
        },
        outDir: "../dist",
        assetsDir: ".",
        emptyOutDir: true,
    },
    plugins: [vue()],
    server: {
        port: 3000,
        open: true,
    },
});
