import { runCommand } from "./command.ts";

export type WorkingTreeEntry = {
	indexStatus: string;
	workTreeStatus: string;
	code: string;
	path: string;
	originalPath?: string;
};

function normalizeRenamePath(value: string): { path: string; originalPath?: string } {
	const renameParts = value.split(" -> ");
	if (renameParts.length === 2) {
		return { originalPath: renameParts[0], path: renameParts[1] };
	}
	return { path: value };
}

export function parseGitStatusShort(output: string): WorkingTreeEntry[] {
	return output
		.split(/\r?\n/)
		.map((line) => line.trimEnd())
		.filter(Boolean)
		.map((line) => {
			const code = line.slice(0, 2);
			const pathText = line.slice(3).trim();
			const normalized = normalizeRenamePath(pathText);
			return {
				indexStatus: code[0] ?? " ",
				workTreeStatus: code[1] ?? " ",
				code,
				path: normalized.path,
				originalPath: normalized.originalPath,
			};
		});
}

export function isSuspiciousWorkingTreeEntry(entry: WorkingTreeEntry): boolean {
	const path = entry.path;
	const isUntracked = entry.code === "??";
	if (/\/(?:node_modules|coverage|dist|build|tmp)\//.test(`/${path}`) && isUntracked) return true;
	if (/(?:^|\/)\.DS_Store$/.test(path)) return true;
	if (/\.(?:log|tmp|swp|swo|bak)$/i.test(path)) {
		if (path.startsWith(".pi/workflows/github-issue-driven-dev/current/")) return false;
		return true;
	}
	return false;
}

export function summarizeWorkingTreeEntries(entries: WorkingTreeEntry[]): string {
	if (entries.length === 0) {
		return ["## Working tree", "- clean", "", "## Suspicious file candidates", "- none", ""].join("\n");
	}
	const suspicious = entries.filter(isSuspiciousWorkingTreeEntry);
	return [
		"## Working tree",
		...entries.map((entry) => `- [${entry.code}] ${entry.path}${entry.originalPath ? ` (from ${entry.originalPath})` : ""}`),
		"",
		"## Suspicious file candidates",
		...(suspicious.length > 0 ? suspicious.map((entry) => `- [${entry.code}] ${entry.path}`) : ["- none"]),
		"",
	].join("\n");
}

export async function summarizeWorkingTreeStatus(repoRoot: string): Promise<string> {
	const result = await runCommand("git status --short --untracked-files=all", repoRoot);
	if (result.exitCode !== 0) {
		throw new Error(result.stderr || "failed to inspect git working tree");
	}
	return summarizeWorkingTreeEntries(parseGitStatusShort(result.stdout));
}
