import type { PrMonitorNextAction } from "../meta.ts";
import type { PrCheck, PullRequestView } from "./view.ts";
import { createChecksSummary } from "./view.ts";

export function summarizeReviewFeedback(pr: PullRequestView): string {
	const reviewLines = (pr.reviews ?? [])
		.filter((review) => (review.body ?? "").trim())
		.map((review) => {
			const author = review.author?.login ?? "unknown";
			const state = review.state ?? "COMMENTED";
			const body = (review.body ?? "").trim();
			return `- [review:${state}] ${author}: ${body}`;
		});
	const commentLines = (pr.comments ?? [])
		.filter((comment) => (comment.body ?? "").trim())
		.map((comment) => {
			const author = comment.author?.login ?? "unknown";
			const body = (comment.body ?? "").trim();
			return `- [comment] ${author}: ${body}`;
		});
	const lines = [...reviewLines, ...commentLines];
	return lines.length > 0 ? lines.join("\n") : "- no comment body";
}

export function createPrMonitorMarkdown(pr: PullRequestView, checks: PrCheck[], nextAction: PrMonitorNextAction, note: string): string {
	const status = pr.mergedAt ? "MERGED" : checks.every((check) => (check.bucket ?? "pass") !== "pending") ? "COMPLETE" : "PENDING";
	return [
		`PR_MONITOR: ${nextAction}`,
		"",
		"## PR",
		`- url: ${pr.url}`,
		`- state: ${pr.state ?? "UNKNOWN"}`,
		`- mergedAt: ${pr.mergedAt ?? "<not merged>"}`,
		`- updatedAt: ${pr.updatedAt ?? "<unknown>"}`,
		`- status: ${status}`,
		"",
		"## Checks",
		createChecksSummary(checks),
		"",
		"## Summary",
		`- nextAction: ${nextAction}`,
		`- note: ${note}`,
		"",
	].join("\n");
}
