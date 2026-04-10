import { test, expect } from "./fixtures";

test.describe("Popup", () => {
	test("popupが正しく開ける", async ({ page, extensionUrl }) => {
		// popup.htmlを新しいページとして開く
		await page.goto(extensionUrl("popup.html"));

		// popupのコンテンツが表示されることを確認
		await expect(page.locator("main")).toBeVisible();
	});
});
