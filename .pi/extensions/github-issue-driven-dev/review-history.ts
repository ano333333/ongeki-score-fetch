export function countReviewRounds(history: string): number {
	return (history.match(/^## Review Round /gm) ?? []).length;
}

export function appendReviewRound(history: string, entryBody: string): string {
	const reviewRound = countReviewRounds(history) + 1;
	const trimmedEntryBody = entryBody.trimEnd();
	return history.trim()
		? `${history.trimEnd()}\n\n## Review Round ${reviewRound}\n\n${trimmedEntryBody}\n`
		: `# Review History\n\n## Review Round ${reviewRound}\n\n${trimmedEntryBody}\n`;
}

export function detectLatestReviewDisposition(history: string): "ACCEPTED" | "REJECTED" | null {
	const matches = Array.from(history.matchAll(/REVIEW:\s*(ACCEPTED|REJECTED)/gim));
	const last = matches.at(-1)?.[1]?.toUpperCase();
	if (last === "ACCEPTED" || last === "REJECTED") return last;
	return null;
}

export function extractLatestReviewRound(reviewHistory: string): string {
	const sections = reviewHistory
		.split(/^## Review Round /gm)
		.map((section) => section.trim())
		.filter(Boolean);
	const latest = sections.at(-1);
	return latest ? `## Review Round ${latest}`.trim() : "";
}
