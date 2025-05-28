import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("File Load Test", async () => {
	// 相対パスはchrome-extensionから始める
	const file = readFileSync("./tests/node.test.ts.text", "utf-8");
	expect(file).toBe("test");
});
