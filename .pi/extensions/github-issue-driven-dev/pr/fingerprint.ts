import type { PullRequestView } from "./view.ts";

export type FingerprintItem = {
	kind: "comment" | "review";
	author: string;
	body: string;
	createdAt?: string;
	updatedAt?: string;
	url?: string;
	state?: string;
	submittedAt?: string;
};

export function fingerprintItems(pr: PullRequestView): FingerprintItem[] {
	return [
		...(pr.comments ?? []).map((comment) => ({
			kind: "comment" as const,
			author: comment.author?.login ?? "",
			body: comment.body ?? "",
			createdAt: comment.createdAt ?? "",
			updatedAt: comment.updatedAt ?? "",
			url: comment.url ?? "",
		})),
		...(pr.reviews ?? []).map((review) => ({
			kind: "review" as const,
			author: review.author?.login ?? "",
			body: review.body ?? "",
			state: review.state ?? "",
			submittedAt: review.submittedAt ?? "",
			updatedAt: review.updatedAt ?? "",
			url: review.url ?? "",
		})),
	];
}

export function commentFingerprint(pr: PullRequestView): string {
	return JSON.stringify(fingerprintItems(pr));
}

export function parseFingerprint(value: unknown): FingerprintItem[] {
	if (typeof value !== "string" || !value.trim()) return [];
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? (parsed as FingerprintItem[]) : [];
	} catch {
		return [];
	}
}

export function diffFingerprintItems(previous: FingerprintItem[], current: FingerprintItem[]): FingerprintItem[] {
	const known = new Set(previous.map((item) => JSON.stringify(item)));
	return current.filter((item) => !known.has(JSON.stringify(item)));
}

export function summarizeFingerprintItems(items: FingerprintItem[]): string {
	if (items.length === 0) return "- none";
	return items
		.map((item) => {
			const state = item.kind === "review" && item.state ? `:${item.state}` : "";
			const body = item.body.trim() || "<empty>";
			return `- [${item.kind}${state}] ${item.author || "unknown"} @ ${item.url || item.updatedAt || "<unknown>"}: ${body}`;
		})
		.join("\n");
}
