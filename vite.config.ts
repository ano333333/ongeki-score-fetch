import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import fs from "fs";

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                popup: path.join(__dirname, "src/popup.html"),
            },
        },
        outDir: "dist",
        assetsDir: ".",
        emptyOutDir: true,
    },
    plugins: [vue()],
    server: {
        port: 3000,
        open: true,
    },
});
