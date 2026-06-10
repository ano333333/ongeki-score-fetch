import { DEFAULT_CONFIG, REVIEW_FILE_PATH } from "../constants.ts";
import { runDelegatedAgent } from "../subagent.ts";
import type { FingerprintItem } from "./fingerprint.ts";
import { summarizeFingerprintItems } from "./fingerprint.ts";

export async function judgePrFeedbackWithAgent(
	repoRoot: string,
	activeDir: string,
	prUrl: string,
	reviewHistory: string,
	previousItems: FingerprintItem[],
	changedItems: FingerprintItem[],
): Promise<{ decision: "USER_CONFIRM" | "REVIEW_REJECTED"; replyNeeded: boolean; note: string }> {
	const monitorText = await runDelegatedAgent(
		repoRoot,
		DEFAULT_CONFIG.prMonitorAgent,
		[
			"現在の PR 監視について、人手レビューが必要かを自然言語で判定してください。",
			`Repository root: ${repoRoot}`,
			`Workflow directory: ${activeDir}`,
			`PR URL: ${prUrl}`,
			`レビュー履歴ファイル: ${REVIEW_FILE_PATH}`,
			reviewHistory.trim() ? `現在の review markdown:\n\n${reviewHistory}` : "現在 review markdown は空です。",
			`前回までに観測済みの PR feedback:\n${summarizeFingerprintItems(previousItems)}`,
			`今回新たに観測した PR feedback:\n${summarizeFingerprintItems(changedItems)}`,
			"判定ルール:",
			"- 実装修正や review 再対応が必要なら REVIEW_REJECTED",
			"- 既知内容の言い換え、情報提供、軽微な bot 更新、返信だけでよい内容なら USER_CONFIRM",
			"- review markdown を踏まえて返信した方がよいなら COMMENT_REPLY_NEEDED: yes",
			"最終出力は必ず次の3行で始めてください。",
			"PR_MONITOR_DECISION: USER_CONFIRM または REVIEW_REJECTED",
			"COMMENT_REPLY_NEEDED: yes または no",
			"NOTE: <short note>",
		].join("\n\n"),
	);
	const decisionMatch = monitorText.match(/^PR_MONITOR_DECISION:\s*(USER_CONFIRM|REVIEW_REJECTED)\s*$/im);
	const replyMatch = monitorText.match(/^COMMENT_REPLY_NEEDED:\s*(yes|no)\s*$/im);
	const noteMatch = monitorText.match(/^NOTE:\s*(.+)$/im);
	if (!decisionMatch || !replyMatch) {
		throw new Error(`PR monitor agent returned an invalid decision:\n${monitorText}`);
	}
	return {
		decision: decisionMatch[1] as "USER_CONFIRM" | "REVIEW_REJECTED",
		replyNeeded: replyMatch[1] === "yes",
		note: noteMatch?.[1]?.trim() || "delegated PR monitor decision",
	};
}
