import { ISSUE_PATH, PLAN_PATH, REVIEW_FILE_PATH } from "../constants.ts";
import { ensureDir, readTextIfExists, writeText } from "../io.ts";
import type { LatestReviewDisposition } from "../meta.ts";
import { saveMeta } from "../meta.ts";
import { repoPath } from "../paths.ts";
import { loadProjectConfig } from "../project-config.ts";
import { appendReviewRound, detectLatestReviewDisposition } from "../review-history.ts";
import { runDelegatedAgent } from "../subagent.ts";
import { WorkflowErrorTransition } from "../workflow-transition.ts";
import { summarizeWorkingTreeStatus } from "../working-tree.ts";

export function createReviewHandler(repoRoot: string, activeDir: string, reviewsDir: string) {
	return async () => {
		const config = await loadProjectConfig(repoRoot);
		await ensureDir(reviewsDir);
		const reviewFilePath = repoPath(repoRoot, REVIEW_FILE_PATH);
		const reviewHistory = await readTextIfExists(reviewFilePath);
		const workTreeSummary = await summarizeWorkingTreeStatus(repoRoot);
		const reviewText = await runDelegatedAgent(
			repoRoot,
			config.reviewAgent,
			[
				"選択中の issue workflow に対する現在の repository diff をレビューしてください。",
				`Repository root: ${repoRoot}`,
				`Workflow directory: ${activeDir}`,
				`必ず ${ISSUE_PATH} と ${PLAN_PATH} を読んでください。`,
				`レビュー履歴ファイル: ${REVIEW_FILE_PATH}`,
				reviewHistory.trim()
					? `以下は同一ファイルに蓄積されている過去のレビュー履歴と修正メモです。これを踏まえて今回のレビューだけを出力してください。\n\n${reviewHistory}`
					: "今回が初回レビューです。まだレビュー履歴ファイルの内容はありません。",
				"あわせて、不要ファイルや生成物の混入がないかも確認してください。",
				`現在の working tree 要約:\n\n${workTreeSummary}`,
				"あなたの出力は workflow 側で同じレビュー履歴ファイルに追記されます。",
				"1 行目は必ず次のいずれか 1 つにしてください。",
				"REVIEW: ACCEPTED",
				"REVIEW: REJECTED",
			].join("\n\n"),
		);
		const reviewEntry = appendReviewRound(reviewHistory, reviewText);
		await writeText(reviewFilePath, reviewEntry);
		const disposition: LatestReviewDisposition = detectLatestReviewDisposition(reviewText) ?? "UNKNOWN";
		await saveMeta(repoRoot, {
			latestReviewFile: REVIEW_FILE_PATH,
			latestReviewDisposition: disposition,
			reviewAgent: config.reviewAgent,
			reviewUpdatedAt: new Date().toISOString(),
		});
		if (disposition !== "ACCEPTED") throw new WorkflowErrorTransition(`review rejected: see ${REVIEW_FILE_PATH}`);
		return { reviewFile: REVIEW_FILE_PATH };
	};
}
