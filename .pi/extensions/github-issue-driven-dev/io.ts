import * as fs from "node:fs";
import * as path from "node:path";

export async function ensureDir(dirPath: string): Promise<void> {
	await fs.promises.mkdir(dirPath, { recursive: true });
}

export async function resetDir(dirPath: string): Promise<void> {
	await fs.promises.rm(dirPath, { recursive: true, force: true });
	await ensureDir(dirPath);
}

export async function writeText(filePath: string, content: string): Promise<void> {
	await ensureDir(path.dirname(filePath));
	await fs.promises.writeFile(filePath, content, "utf8");
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
	await writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJson<T>(filePath: string): Promise<T | null> {
	try {
		return JSON.parse(await fs.promises.readFile(filePath, "utf8")) as T;
	} catch (error) {
		if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
			return null;
		}
		throw error;
	}
}

export async function readTextIfExists(filePath: string): Promise<string> {
	try {
		return await fs.promises.readFile(filePath, "utf8");
	} catch {
		return "";
	}
}

export async function listReviewFiles(dirPath: string): Promise<string[]> {
	try {
		const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
			.map((entry) => path.join(dirPath, entry.name))
			.sort();
	} catch {
		return [];
	}
}
