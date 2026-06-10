import { runCommand } from "./command.ts";

export async function getCurrentBranch(repoRoot: string): Promise<string> {
	const branchResult = await runCommand("git branch --show-current", repoRoot);
	const branch = branchResult.stdout.trim();
	if (branchResult.exitCode !== 0 || !branch) {
		throw new Error(branchResult.stderr || "failed to determine current branch for push");
	}
	return branch;
}

export async function pushCurrentBranch(repoRoot: string): Promise<string> {
	const branch = await getCurrentBranch(repoRoot);
	const pushResult = await runCommand("git push", repoRoot);
	if (pushResult.exitCode === 0) return branch;

	const fallbackResult = await runCommand(`git push --set-upstream origin ${JSON.stringify(branch)}`, repoRoot);
	if (fallbackResult.exitCode !== 0) {
		throw new Error(fallbackResult.stderr || pushResult.stderr || `failed to push branch ${branch}`);
	}
	return branch;
}
