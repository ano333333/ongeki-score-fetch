import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
	root: "src",
	build: {
		rollupOptions: {
			input: {
				popup: "src/popup.html",
				// offscreen: "src/offscreen.html",
				// background: "src/background.ts",
				// option: "src/options.html",
				// redirect: "src/redirect.html",
			},
			output: {
				entryFileNames: "[name].js", // 追加: 出力ファイル名を指定
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
