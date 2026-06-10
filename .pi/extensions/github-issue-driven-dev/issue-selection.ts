import { runCommand, runGhJson } from "./command.ts";
import { DEFAULT_CONFIG } from "./constants.ts";
import type { GhIssue, SelectedIssue, SelectionRequestInfo } from "./types.ts";

export async function listOpenIssues(cwd: string): Promise<{ repo: string; issues: GhIssue[] }> {
	const repo = DEFAULT_CONFIG.repo ?? (await inferRepoFromOrigin(cwd));
	const issues = await runGhJson<GhIssue[]>(
		[
			"issue",
			"list",
			"--repo",
			repo,
			"--state",
			"open",
			"--limit",
			String(DEFAULT_CONFIG.issueLimit),
			"--json",
			"number,title,body,url,labels,assignees,updatedAt",
		],
		cwd,
	);
	return { repo, issues };
}

export function parseGitHubRepoFromRemote(remoteUrl: string): string | null {
	const trimmed = remoteUrl.trim();
	const sshMatch = trimmed.match(/^git@github\.com:(.+?)(?:\.git)?$/);
	if (sshMatch?.[1]) return sshMatch[1];
	const httpsMatch = trimmed.match(/^https:\/\/github\.com\/(.+?)(?:\.git)?$/);
	if (httpsMatch?.[1]) return httpsMatch[1];
	return null;
}

export async function inferRepoFromOrigin(cwd: string): Promise<string> {
	const result = await runCommand("git remote get-url origin", cwd);
	if (result.exitCode !== 0) {
		throw new Error("Failed to infer GitHub repo from origin. Set config.repo explicitly.");
	}
	const repo = parseGitHubRepoFromRemote(result.stdout);
	if (!repo) {
		throw new Error(`Origin is not a GitHub remote: ${result.stdout.trim()}`);
	}
	return repo;
}

export function extractDependencies(body: string | undefined, defaultRepo: string): Array<{ repo: string; number: number }> {
	const text = body ?? "";
	const results: Array<{ repo: string; number: number }> = [];
	const sameRepoPattern = /(?:blocked by|depends on)\s+#(\d+)/gi;
	const crossRepoPattern = /(?:blocked by|depends on)\s+([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#(\d+)/gi;
	for (const match of text.matchAll(crossRepoPattern)) {
		results.push({ repo: match[1], number: Number(match[2]) });
	}
	for (const match of text.matchAll(sameRepoPattern)) {
		results.push({ repo: defaultRepo, number: Number(match[1]) });
	}
	const dedup = new Map<string, { repo: string; number: number }>();
	for (const dep of results) {
		dedup.set(`${dep.repo}#${dep.number}`, dep);
	}
	return Array.from(dedup.values());
}

export function hasBlockerLabel(issue: GhIssue): boolean {
	return issue.labels.some((label) => /blocker/i.test(label.name));
}

export function getPriorityLabel(issue: GhIssue, priorityOrder: string[]): string | null {
	for (const label of priorityOrder) {
		if (issue.labels.some((candidate) => candidate.name === label)) {
			return label;
		}
	}
	return null;
}

async function resolveDependencyStates(
	cwd: string,
	repo: string,
	issue: GhIssue,
): Promise<{ dependencies: Array<{ repo: string; number: number; state: string }>; hasOpenDependency: boolean }> {
	const dependencies = extractDependencies(issue.body, repo);
	const dependencyStates: Array<{ repo: string; number: number; state: string }> = [];
	let hasOpenDependency = false;
	for (const dependency of dependencies) {
		const detail = await runGhJson<{ state: string }>(
			["issue", "view", String(dependency.number), "--repo", dependency.repo, "--json", "state"],
			cwd,
		);
		dependencyStates.push({ ...dependency, state: detail.state });
		if (detail.state.toUpperCase() === "OPEN") {
			hasOpenDependency = true;
		}
	}
	return { dependencies: dependencyStates, hasOpenDependency };
}

export async function resolveSpecifiedIssue(cwd: string, issueNumber: number): Promise<SelectedIssue> {
	const repo = DEFAULT_CONFIG.repo ?? (await inferRepoFromOrigin(cwd));
	const issue = await runGhJson<GhIssue>(
		["issue", "view", String(issueNumber), "--repo", repo, "--json", "number,title,body,url,labels,assignees,updatedAt"],
		cwd,
	);
	const { dependencies } = await resolveDependencyStates(cwd, repo, issue);
	return {
		repo,
		issue,
		priorityLabel: getPriorityLabel(issue, DEFAULT_CONFIG.priorityOrder) ?? "manual",
		dependencies,
	};
}

export function parseSelectionRequest(requestText: string): SelectionRequestInfo {
	const raw = requestText.trim();
	if (!raw) {
		return {
			raw,
			explicitIssueNumber: null,
			hasExplicitIssueNumber: false,
			overridesDefaultCriteria: false,
		};
	}

	const explicitMatch =
		raw.match(/(?:^|\s)#(\d+)(?=\D|$)/) ??
		raw.match(/^\s*(\d+)\s*(?:[,、:：\-]|$)/) ??
		raw.match(/(?:issue|Issue|ISSUE)\s*#?(\d+)(?=\D|$)/);
	const explicitIssueNumber = explicitMatch ? Number(explicitMatch[1]) : null;

	return {
		raw,
		explicitIssueNumber,
		hasExplicitIssueNumber: explicitIssueNumber !== null,
		overridesDefaultCriteria: explicitIssueNumber !== null,
	};
}

export async function resolveSelectedIssue(cwd: string): Promise<SelectedIssue> {
	const { repo, issues } = await listOpenIssues(cwd);

	const ranked = issues
		.map((issue) => ({ issue, priorityLabel: getPriorityLabel(issue, DEFAULT_CONFIG.priorityOrder) }))
		.filter((item) => item.priorityLabel)
		.filter((item) => item.issue.assignees.length === 0)
		.filter((item) => !hasBlockerLabel(item.issue))
		.sort((left, right) => {
			const leftRank = DEFAULT_CONFIG.priorityOrder.indexOf(left.priorityLabel ?? "");
			const rightRank = DEFAULT_CONFIG.priorityOrder.indexOf(right.priorityLabel ?? "");
			if (leftRank !== rightRank) return leftRank - rightRank;
			return left.issue.number - right.issue.number;
		});

	for (const candidate of ranked) {
		const { dependencies, hasOpenDependency } = await resolveDependencyStates(cwd, repo, candidate.issue);
		if (!hasOpenDependency) {
			return {
				repo,
				issue: candidate.issue,
				priorityLabel: candidate.priorityLabel ?? DEFAULT_CONFIG.priorityOrder[0],
				dependencies,
			};
		}
	}

	throw new Error("No selectable issue found with the configured priority and dependency rules.");
}

export function formatIssueMarkdown(selected: SelectedIssue): string {
	const labels = selected.issue.labels.map((label) => label.name).join(", ") || "<none>";
	const dependencies =
		selected.dependencies.length === 0
			? "- none"
			: selected.dependencies.map((dep) => `- ${dep.repo}#${dep.number} (${dep.state})`).join("\n");
	return [
		`# Issue #${selected.issue.number}: ${selected.issue.title}`,
		"",
		`- Repo: ${selected.repo}`,
		`- URL: ${selected.issue.url}`,
		`- Priority label: ${selected.priorityLabel}`,
		`- Labels: ${labels}`,
		"",
		"## Dependency check",
		dependencies,
		"",
		"## Body",
		selected.issue.body?.trim() || "<empty>",
		"",
	].join("\n");
}

export function formatSelectionMarkdown(selected: SelectedIssue): string {
	return [
		"# Selection summary",
		"",
		"Selected using the original github-issue-driven-dev criteria:",
		"",
		"- high-priority label",
		"- no assignee",
		"- no blocker label",
		"- no open dependency issue referenced from the body via phrases such as `blocked by #123` or `depends on #123`",
		"",
		`Selected issue: ${selected.repo}#${selected.issue.number} ${selected.issue.title}`,
		`Priority label: ${selected.priorityLabel}`,
		selected.dependencies.length === 0
			? "Dependency check: no explicit dependencies found"
			: `Dependency check: ${selected.dependencies.map((dep) => `${dep.repo}#${dep.number}=${dep.state}`).join(", ")}`,
		"",
	].join("\n");
}

export function formatIssueCandidatesMarkdown(repo: string, issues: GhIssue[]): string {
	return [
		`# Open issues for ${repo}`,
		"",
		...issues.flatMap((issue) => {
			const labels = issue.labels.map((label) => label.name).join(", ") || "<none>";
			const assignees = issue.assignees.map((assignee) => assignee.login).join(", ") || "<none>";
			return [
				`## #${issue.number}: ${issue.title}`,
				"",
				`- URL: ${issue.url}`,
				`- Labels: ${labels}`,
				`- Assignees: ${assignees}`,
				`- UpdatedAt: ${issue.updatedAt ?? "<unknown>"}`,
				"",
				"### Body",
				issue.body?.trim() || "<empty>",
				"",
			];
		}),
	].join("\n");
}

export function formatSelectionRequestMarkdown(requestText: string): string {
	const request = parseSelectionRequest(requestText);
	return [
		"# Selection request",
		"",
		"## Raw request",
		"",
		request.raw || "<empty>",
		"",
		"## Interpreted guidance",
		"",
		request.hasExplicitIssueNumber
			? `- Explicit issue request detected: #${request.explicitIssueNumber}`
			: "- No explicit issue number detected",
		request.overridesDefaultCriteria
			? "- Treat the explicit request as the primary instruction even if it overrides the default automatic criteria"
			: "- If the request is empty or ambiguous, prefer the default automatic criteria",
		"",
		"## Default automatic criteria",
		"",
		"- highest priority label",
		"- no assignee",
		"- no blocker label",
		"- no open dependency referenced from the body via phrases such as `blocked by #123` or `depends on #123`",
		"",
	].join("\n");
}
