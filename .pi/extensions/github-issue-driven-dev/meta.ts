import { META_PATH } from "./constants.ts";
import { readJson, writeJson } from "./io.ts";
import { repoPath } from "./paths.ts";

export async function loadMeta(repoRoot: string): Promise<Record<string, unknown>> {
	return (await readJson<Record<string, unknown>>(repoPath(repoRoot, META_PATH))) ?? {};
}

export async function saveMeta(repoRoot: string, patch: Record<string, unknown>): Promise<void> {
	const current = await loadMeta(repoRoot);
	await writeJson(repoPath(repoRoot, META_PATH), { ...current, ...patch });
}
