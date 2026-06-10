import { runGhJson } from "../command.ts";
import { COMMITS_PATH, DEFAULT_CONFIG, ISSUE_PATH, PLAN_PATH, PR_PATH, REVIEW_FILE_PATH } from "../constants.ts";
import { pushCurrentBranch } from "../git.ts";
import { writeText } from "../io.ts";
import { loadMeta, saveMeta } from "../meta.ts";
import { repoPath } from "../paths.ts";
import { findOpenPrForCurrentBranch, isOpenPr } from "../pr/view.ts";
import { runDelegatedAgent } from "../subagent.ts";

export function createPrHandler(repoRoot: string, activeDir: string) {
	return async () => {
		const meta = await loadMeta(repoRoot);
		const existingMetaUrl = typeof meta.prUrl === "string" && meta.prUrl ? meta.prUrl : null;
		if (existingMetaUrl) {
			try {
				const existingMetaPr = await runGhJson<{ url: string; state?: string | null; mergedAt?: string | null }>(
					["pr", "view", existingMetaUrl, "--json", "url,state,mergedAt"],
					repoRoot,
				);
				if (isOpenPr(existingMetaPr)) {
					const pushedBranch = await pushCurrentBranch(repoRoot);
					await writeText(
						repoPath(repoRoot, PR_PATH),
						`PR_URL: ${existingMetaUrl}\n\n既存の PR を metadata から再利用し、branch ${pushedBranch} を push しました。\n`,
					);
					await saveMeta(repoRoot, {
						prUrl: existingMetaUrl,
						prSkippedAt: new Date().toISOString(),
						prPushedAt: new Date().toISOString(),
						prPushedBranch: pushedBranch,
						prWorkflowCompletedAt: null,
						prMonitorDisposition: undefined,
						prMonitorNextAction: undefined,
						prAgent: DEFAULT_CONFIG.prAgent,
					});
					return { prPath: PR_PATH, prUrl: existingMetaUrl, skipped: true, pushedBranch };
				}
				await saveMeta(repoRoot, {
					prUrl: null,
					prMonitorNextAction: undefined,
					prMonitorDisposition: undefined,
				});
			} catch {
				await saveMeta(repoRoot, { prUrl: null });
			}
		}

		const existingBranchPrUrl = await findOpenPrForCurrentBranch(repoRoot).catch(() => null);
		if (existingBranchPrUrl) {
			const pushedBranch = await pushCurrentBranch(repoRoot);
			await writeText(
				repoPath(repoRoot, PR_PATH),
				`PR_URL: ${existingBranchPrUrl}\n\n既存の open PR を再利用し、branch ${pushedBranch} を push しました。\n`,
			);
			await saveMeta(repoRoot, {
				prUrl: existingBranchPrUrl,
				prSkippedAt: new Date().toISOString(),
				prPushedAt: new Date().toISOString(),
				prPushedBranch: pushedBranch,
				prWorkflowCompletedAt: null,
				prMonitorDisposition: undefined,
				prMonitorNextAction: undefined,
				prAgent: DEFAULT_CONFIG.prAgent,
			});
			return { prPath: PR_PATH, prUrl: existingBranchPrUrl, skipped: true, pushedBranch };
		}

		const prText = await runDelegatedAgent(
			repoRoot,
			DEFAULT_CONFIG.prAgent,
			[
				"現在の branch について gh を使って pull request を作成してください。",
				`Repository root: ${repoRoot}`,
				`Workflow directory: ${activeDir}`,
				`必ず ${ISSUE_PATH}、${PLAN_PATH}、${COMMITS_PATH}、${REVIEW_FILE_PATH} を文脈として読んでください。`,
				"実際に gh pr create を実行してください。",
				"最終出力の 1 行目は必ず 'PR_URL: <url>' にしてください。",
			].join("\n\n"),
		);
		await writeText(repoPath(repoRoot, PR_PATH), `${prText.trimEnd()}\n`);
		const urlMatch = prText.match(/^PR_URL:\s*(https?:\/\/\S+)/im);
		await saveMeta(repoRoot, {
			prUrl: urlMatch?.[1] ?? null,
			prCreatedAt: new Date().toISOString(),
			prWorkflowCompletedAt: null,
			prMonitorDisposition: undefined,
			prMonitorNextAction: undefined,
			prAgent: DEFAULT_CONFIG.prAgent,
		});
		if (!urlMatch?.[1]) throw new Error(`PR URL not found in ${PR_PATH}`);
		return { prPath: PR_PATH, prUrl: urlMatch[1] };
	};
}
