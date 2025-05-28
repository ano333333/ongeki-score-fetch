import { defineWorkspace } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineWorkspace([
	{
		root: ".",
		test: {
			include: ["tests/**/*.test.ts"],
			exclude: ["tests/**/*.browser.test.ts"],
			name: "unit",
			environment: "node",
		},
	},
	{
		root: ".",
		test: {
			include: ["tests/**/*.browser.test.ts"],
			name: "browser",
			browser: {
				provider: "playwright",
				enabled: true,
				instances: [
					{
						browser: "chromium",
					},
				],
			},
		},
		plugins: [vue()],
		setupFiles: ["vitest-browser-vue"],
	},
]);
