import { runGhJson } from "../command.ts";
import { getCurrentBranch } from "../git.ts";

export type PullRequestComment = {
	author?: { login?: string | null } | null;
	body?: string | null;
	createdAt?: string | null;
	updatedAt?: string | null;
	url?: string | null;
};

export type PullRequestReview = {
	author?: { login?: string | null } | null;
	body?: string | null;
	state?: string | null;
	submittedAt?: string | null;
	updatedAt?: string | null;
	url?: string | null;
};

export type PullRequestView = {
	url: string;
	title?: string;
	state?: string;
	mergedAt?: string | null;
	updatedAt?: string | null;
	comments?: PullRequestComment[];
	reviews?: PullRequestReview[];
};

export type PullRequestStatusView = Pick<PullRequestView, "url" | "title" | "state" | "mergedAt" | "updatedAt">;

export type PrCheck = {
	bucket?: string | null;
	completedAt?: string | null;
	description?: string | null;
	link?: string | null;
	name?: string | null;
	state?: string | null;
	workflow?: string | null;
};

export function createChecksSummary(checks: PrCheck[]): string {
	if (checks.length === 0) return "- no checks found";
	return checks
		.map((check) => {
			const name = check.name ?? check.workflow ?? "<unknown>";
			const bucket = check.bucket ?? check.state ?? "unknown";
			return `- ${name}: ${bucket}`;
		})
		.join("\n");
}

export function isPendingCheck(check: PrCheck): boolean {
	const values = [check.bucket, check.state]
		.filter((value): value is string => typeof value === "string" && value.length > 0)
		.map((value) => value.toLowerCase());
	return values.some((value) =>
		["pending", "queued", "startup", "in_progress", "in progress", "waiting", "requested", "expected"].includes(value),
	);
}

export async function findOpenPrForCurrentBranch(repoRoot: string): Promise<string | null> {
	const branch = await getCurrentBranch(repoRoot);
	const prs = await runGhJson<Array<{ url?: string | null }>>(
		["pr", "list", "--head", branch, "--state", "open", "--json", "url", "--limit", "1"],
		repoRoot,
	);
	return prs[0]?.url ?? null;
}

export function isOpenPr(pr: { state?: string | null; mergedAt?: string | null }): boolean {
	return pr.state === "OPEN" && !pr.mergedAt;
}

export function isClosedUnmergedPr(pr: { state?: string | null; mergedAt?: string | null }): boolean {
	return pr.state === "CLOSED" && !pr.mergedAt;
}
