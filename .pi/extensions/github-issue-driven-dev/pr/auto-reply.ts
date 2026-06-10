import { runCommand, runGhJson } from "../command.ts";
import { extractLatestReviewRound } from "../review-history.ts";
import type { FingerprintItem } from "./fingerprint.ts";
import { diffFingerprintItems, fingerprintItems } from "./fingerprint.ts";
import type { PullRequestView } from "./view.ts";

export function isCodeRabbitLikeAuthor(author: string): boolean {
	return author.toLowerCase().includes("coderabbit");
}

export function createReplyMarker(source: FingerprintItem): string {
	return `<!-- pi-pr-monitor-reply:${source.url ?? source.updatedAt ?? source.body.slice(0, 80)} -->`;
}

export function hasExistingReplyFromViewer(pr: PullRequestView, viewerLogin: string, source: FingerprintItem): boolean {
	const marker = createReplyMarker(source);
	return (pr.comments ?? []).some((comment) => (comment.author?.login ?? "") === viewerLogin && (comment.body ?? "").includes(marker));
}

export function createAutoReplyBody(source: FingerprintItem, reviewHistory: string): string {
	const latestRound = extractLatestReviewRound(reviewHistory);
	const sourceSummary = source.body.trim() ? source.body.trim() : "(comment body omitted)";
	const reviewSummary = latestRound ? latestRound.slice(0, 3000).trim() : "レビュー履歴に基づき、必要な対応は実施済みです。";
	return [
		createReplyMarker(source),
		"対応しました。レビュー履歴に沿って確認・修正済みです。再確認をお願いします。",
		"",
		`対象コメント: ${sourceSummary}`,
		"",
		"参考: 最新の review markdown 要約",
		"```md",
		reviewSummary,
		"```",
	].join("\n");
}

export async function postPrComment(repoRoot: string, prUrl: string, body: string): Promise<void> {
	const heredoc = "__PI_PR_MONITOR_COMMENT__";
	const command = [
		'tmp_file="$(mktemp)"',
		`cat <<'${heredoc}' > "$tmp_file"`,
		body,
		heredoc,
		`gh ${["pr", "comment", prUrl, "--body-file", "$tmp_file"].map((arg) => JSON.stringify(arg)).join(" ")}`,
		"status=$?",
		'rm -f "$tmp_file"',
		"exit $status",
	].join("\n");
	const result = await runCommand(command, repoRoot);
	if (result.exitCode !== 0) {
		throw new Error(result.stderr || `failed to post comment to ${prUrl}`);
	}
}

export async function getViewerLogin(repoRoot: string): Promise<string> {
	const viewer = await runGhJson<{ login?: string | null }>(["api", "user"], repoRoot);
	return viewer.login ?? "";
}

export function collectAutoReplyTargets(pr: PullRequestView, previousItems: FingerprintItem[], viewerLogin: string): FingerprintItem[] {
	const changedItems = diffFingerprintItems(previousItems, fingerprintItems(pr));
	return changedItems.filter((item) => {
		if (item.kind !== "comment") return false;
		if (!item.body.trim()) return false;
		if (!isCodeRabbitLikeAuthor(item.author)) return false;
		if (item.author === viewerLogin) return false;
		if (hasExistingReplyFromViewer(pr, viewerLogin, item)) return false;
		return true;
	});
}
