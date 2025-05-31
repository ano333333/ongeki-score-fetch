import { expect, test } from "vitest";
import alert from "../src/views/components/alert.vue";
import { render } from "vitest-browser-vue";
import { ref, nextTick, computed } from "vue";

/**
 * vueのテストを含むため、ブラウザモード(**.browser.test.ts)で実行する
 */
test("Browser Mode & Vue Reactive Template", async () => {
	// reactive
	const array = ref([1, 2, 3]);
	const alertType = computed<"success" | "error">(() =>
		array.value.every((v) => v > 0) ? "success" : "error",
	);
	const props = () => {
		return {
			type: alertType.value,
		};
	};

	// 1回目の要素描画
	const screen = render(alert, {
		props: props(),
	});
	await expect.element(screen.getByText("✓")).toBeVisible();

	// refの値を変更し、nextTickでリアクティブに反映
	array.value = [1, 2, 3, 0];
	await nextTick();

	// 描画を更新
	screen.rerender(props());
	await expect.element(screen.getByText("✕")).toBeVisible();
});
