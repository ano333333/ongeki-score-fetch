import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readJson } from "./io.ts";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-io-test-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("readJson", () => {
	it("returns null for missing files", async () => {
		const dir = await makeTempDir();
		await expect(readJson(path.join(dir, "missing.json"))).resolves.toBeNull();
	});

	it("rethrows invalid JSON parse errors", async () => {
		const dir = await makeTempDir();
		const file = path.join(dir, "invalid.json");
		await fs.writeFile(file, "{ invalid json", "utf8");
		await expect(readJson(file)).rejects.toThrow();
	});
});
