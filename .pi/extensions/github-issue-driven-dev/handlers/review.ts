import { DEFAULT_CONFIG, ISSUE_PATH, PLAN_PATH, REVIEW_FILE_PATH } from "../constants.ts";
import { ensureDir, readTextIfExists, writeText } from "../io.ts";
import { saveMeta } from "../meta.ts";
import { repoPath } from "../paths.ts";
import { runDelegatedAgent } from "../subagent.ts";

function countReviewRounds(reviewHistory: string): number {
	return (reviewHistory.match(/^## Review Round /gm) ?? []).length;
}

function detectLatestReviewDisposition(reviewText: string): "ACCEPTED" | "REJECTED" | "UNKNOWN" {
	const matches = Array.from(reviewText.matchAll(/REVIEW:\s*(ACCEPTED|REJECTED)/gim));
	const last = matches.at(-1)?.[1]?.toUpperCase();
	if (last === "ACCEPTED" || last === "REJECTED") return last;
	return "UNKNOWN";
}

export function createReviewHandler(repoRoot: string, activeDir: string, reviewsDir: string) {
	return async () => {
		await ensureDir(reviewsDir);
		const reviewFilePath = repoPath(repoRoot, REVIEW_FILE_PATH);
		const reviewHistory = await readTextIfExists(reviewFilePath);
		const reviewRound = countReviewRounds(reviewHistory) + 1;
		const reviewText = await runDelegatedAgent(
			repoRoot,
			DEFAULT_CONFIG.reviewAgent,
			[
				"選択中の issue workflow に対する現在の repository diff をレビューしてください。",
				`Repository root: ${repoRoot}`,
				`Workflow directory: ${activeDir}`,
				`必ず ${ISSUE_PATH} と ${PLAN_PATH} を読んでください。`,
				`レビュー履歴ファイル: ${REVIEW_FILE_PATH}`,
				reviewHistory.trim()
					? `以下は同一ファイルに蓄積されている過去のレビュー履歴と修正メモです。これを踏まえて今回のレビューだけを出力してください。\n\n${reviewHistory}`
					: "今回が初回レビューです。まだレビュー履歴ファイルの内容はありません。",
				"あなたの出力は workflow 側で同じレビュー履歴ファイルに追記されます。",
				"1 行目は必ず次のいずれか 1 つにしてください。",
				"REVIEW: ACCEPTED",
				"REVIEW: REJECTED",
			].join("\n\n"),
		);
		const reviewEntry = reviewHistory.trim()
			? `${reviewHistory.trimEnd()}\n\n## Review Round ${reviewRound}\n\n${reviewText.trimEnd()}\n`
			: `# Review History\n\n## Review Round ${reviewRound}\n\n${reviewText.trimEnd()}\n`;
		await writeText(reviewFilePath, reviewEntry);
		const disposition = detectLatestReviewDisposition(reviewText);
		await saveMeta(repoRoot, {
			latestReviewFile: REVIEW_FILE_PATH,
			latestReviewDisposition: disposition,
			reviewAgent: DEFAULT_CONFIG.reviewAgent,
			reviewUpdatedAt: new Date().toISOString(),
		});
		if (disposition !== "ACCEPTED") throw new Error(`review rejected: see ${REVIEW_FILE_PATH}`);
		return { reviewFile: REVIEW_FILE_PATH };
	};
}
