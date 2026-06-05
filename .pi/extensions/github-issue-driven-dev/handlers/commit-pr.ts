import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	COMMITS_PATH,
	DEFAULT_CONFIG,
	ISSUE_PATH,
	PLAN_PATH,
	PR_MONITOR_PATH,
	PR_MONITOR_WAIT_MS,
	PR_PATH,
	REVIEW_FILE_PATH,
} from "../constants.ts";
import { runCommand, runGhJson } from "../command.ts";
import { ensureDir, readTextIfExists, writeText } from "../io.ts";
import { loadMeta, saveMeta } from "../meta.ts";
import { repoPath } from "../paths.ts";
import { runDelegatedAgent } from "../subagent.ts";
import { summarizeWorkingTreeStatus } from "../working-tree.ts";

type PullRequestComment = {
	author?: { login?: string | null } | null;
	body?: string | null;
	createdAt?: string | null;
	updatedAt?: string | null;
	url?: string | null;
};

type PullRequestReview = {
	author?: { login?: string | null } | null;
	body?: string | null;
	state?: string | null;
	submittedAt?: string | null;
	updatedAt?: string | null;
	url?: string | null;
};

type PullRequestView = {
	url: string;
	title?: string;
	state?: string;
	mergedAt?: string | null;
	updatedAt?: string | null;
	comments?: PullRequestComment[];
	reviews?: PullRequestReview[];
};

type PrCheck = {
	bucket?: string | null;
	completedAt?: string | null;
	description?: string | null;
	link?: string | null;
	name?: string | null;
	state?: string | null;
	workflow?: string | null;
};

type PrMonitorNextAction = "WAIT" | "USER_CONFIRM" | "COMPLETED" | "REVIEW_REJECTED";

type MonitorMeta = Record<string, unknown>;

type FingerprintItem = {
	kind: "comment" | "review";
	author: string;
	body: string;
	createdAt?: string;
	updatedAt?: string;
	url?: string;
	state?: string;
	submittedAt?: string;
};

function createChecksSummary(checks: PrCheck[]): string {
	if (checks.length === 0) return "- no checks found";
	return checks
		.map((check) => {
			const name = check.name ?? check.workflow ?? "<unknown>";
			const bucket = check.bucket ?? check.state ?? "unknown";
			return `- ${name}: ${bucket}`;
		})
		.join("\n");
}

function fingerprintItems(pr: PullRequestView): FingerprintItem[] {
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

function commentFingerprint(pr: PullRequestView): string {
	return JSON.stringify(fingerprintItems(pr));
}

function parseIsoTimestamp(value: unknown): number | null {
	if (typeof value !== "string" || !value) return null;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? null : parsed;
}

function getLatestPrCycleStartedAt(meta: MonitorMeta): number | null {
	const candidates = [parseIsoTimestamp(meta.prCreatedAt), parseIsoTimestamp(meta.prPushedAt)].filter(
		(value): value is number => value !== null,
	);
	if (candidates.length === 0) return null;
	return Math.max(...candidates);
}

function hasCompletedCurrentPrCycle(meta: MonitorMeta): boolean {
	const completedAt = parseIsoTimestamp(meta.prWorkflowCompletedAt);
	if (completedAt === null) return false;
	const latestCycleStartedAt = getLatestPrCycleStartedAt(meta);
	if (latestCycleStartedAt === null) return true;
	return completedAt >= latestCycleStartedAt;
}

function isPendingCheck(check: PrCheck): boolean {
	const values = [check.bucket, check.state]
		.filter((value): value is string => typeof value === "string" && value.length > 0)
		.map((value) => value.toLowerCase());
	return values.some((value) =>
		["pending", "queued", "startup", "in_progress", "in progress", "waiting", "requested", "expected"].includes(value),
	);
}

function parseFingerprint(value: unknown): FingerprintItem[] {
	if (typeof value !== "string" || !value.trim()) return [];
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? (parsed as FingerprintItem[]) : [];
	} catch {
		return [];
	}
}

function diffFingerprintItems(previous: FingerprintItem[], current: FingerprintItem[]): FingerprintItem[] {
	const known = new Set(previous.map((item) => JSON.stringify(item)));
	return current.filter((item) => !known.has(JSON.stringify(item)));
}

function countReviewRounds(reviewHistory: string): number {
	return (reviewHistory.match(/^## Review Round /gm) ?? []).length;
}

function summarizeReviewFeedback(pr: PullRequestView): string {
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

function createPrMonitorMarkdown(pr: PullRequestView, checks: PrCheck[], nextAction: PrMonitorNextAction, note: string): string {
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

async function getCurrentBranch(repoRoot: string): Promise<string> {
	const branchResult = await runCommand("git branch --show-current", repoRoot);
	const branch = branchResult.stdout.trim();
	if (branchResult.exitCode !== 0 || !branch) {
		throw new Error(branchResult.stderr || "failed to determine current branch for push");
	}
	return branch;
}

async function pushCurrentBranch(repoRoot: string): Promise<string> {
	const branch = await getCurrentBranch(repoRoot);
	const pushResult = await runCommand("git push", repoRoot);
	if (pushResult.exitCode === 0) return branch;

	const fallbackResult = await runCommand(`git push --set-upstream origin ${JSON.stringify(branch)}`, repoRoot);
	if (fallbackResult.exitCode !== 0) {
		throw new Error(fallbackResult.stderr || pushResult.stderr || `failed to push branch ${branch}`);
	}
	return branch;
}

async function findOpenPrForCurrentBranch(repoRoot: string): Promise<string | null> {
	const branch = await getCurrentBranch(repoRoot);
	const prs = await runGhJson<Array<{ url?: string | null }>>(
		["pr", "list", "--head", branch, "--state", "open", "--json", "url", "--limit", "1"],
		repoRoot,
	);
	return prs[0]?.url ?? null;
}

function isOpenPr(pr: { state?: string | null; mergedAt?: string | null }): boolean {
	return pr.state === "OPEN" && !pr.mergedAt;
}

function isClosedUnmergedPr(pr: { state?: string | null; mergedAt?: string | null }): boolean {
	return pr.state === "CLOSED" && !pr.mergedAt;
}

async function appendRejectedReviewFromPr(repoRoot: string, pr: PullRequestView): Promise<void> {
	const reviewFilePath = repoPath(repoRoot, REVIEW_FILE_PATH);
	await ensureDir(repoPath(repoRoot, REVIEW_FILE_PATH.split("/").slice(0, -1).join("/")));
	const reviewHistory = await readTextIfExists(reviewFilePath);
	const reviewRound = countReviewRounds(reviewHistory) + 1;
	const rejectionBody = [
		"## Scope checked",
		"- PR comments / reviews after workflow completion",
		"",
		"## Critical",
		summarizeReviewFeedback(pr),
		"",
		"## Summary",
		"- workflow 完了後に PR 上のコメントまたは review が変化したため、再対応が必要です。",
		"",
		"REVIEW: REJECTED",
	].join("\n");
	const nextEntry = reviewHistory.trim()
		? `${reviewHistory.trimEnd()}\n\n## Review Round ${reviewRound}\n\n${rejectionBody}\n`
		: `# Review History\n\n## Review Round ${reviewRound}\n\n${rejectionBody}\n`;
	await writeText(reviewFilePath, nextEntry);
}

function isCodeRabbitLikeAuthor(author: string): boolean {
	return author.toLowerCase().includes("coderabbit");
}

function createReplyMarker(source: FingerprintItem): string {
	return `<!-- pi-pr-monitor-reply:${source.url ?? source.updatedAt ?? source.body.slice(0, 80)} -->`;
}

function hasExistingReplyFromViewer(pr: PullRequestView, viewerLogin: string, source: FingerprintItem): boolean {
	const marker = createReplyMarker(source);
	return (pr.comments ?? []).some((comment) => (comment.author?.login ?? "") === viewerLogin && (comment.body ?? "").includes(marker));
}

function extractLatestReviewRound(reviewHistory: string): string {
	const sections = reviewHistory
		.split(/^## Review Round /gm)
		.map((section) => section.trim())
		.filter(Boolean);
	const latest = sections.at(-1);
	return latest ? `## Review Round ${latest}`.trim() : "";
}

function createAutoReplyBody(source: FingerprintItem, reviewHistory: string): string {
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

async function postPrComment(repoRoot: string, prUrl: string, body: string): Promise<void> {
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

async function getViewerLogin(repoRoot: string): Promise<string> {
	const viewer = await runGhJson<{ login?: string | null }>(["api", "user"], repoRoot);
	return viewer.login ?? "";
}

function collectAutoReplyTargets(pr: PullRequestView, previousItems: FingerprintItem[], viewerLogin: string): FingerprintItem[] {
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

function summarizeFingerprintItems(items: FingerprintItem[]): string {
	if (items.length === 0) return "- none";
	return items
		.map((item) => {
			const state = item.kind === "review" && item.state ? `:${item.state}` : "";
			const body = item.body.trim() || "<empty>";
			return `- [${item.kind}${state}] ${item.author || "unknown"} @ ${item.url || item.updatedAt || "<unknown>"}: ${body}`;
		})
		.join("\n");
}

async function judgePrFeedbackWithAgent(
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

export function createCommitHandler(repoRoot: string, activeDir: string) {
	return async () => {
		const workTreeSummary = await summarizeWorkingTreeStatus(repoRoot);
		const commitText = await runDelegatedAgent(
			repoRoot,
			DEFAULT_CONFIG.commitAgent,
			[
				"現在の workflow 変更を、意味のある単位の git commit にまとめてください。",
				`Repository root: ${repoRoot}`,
				`Workflow directory: ${activeDir}`,
				`必ず ${ISSUE_PATH}、${PLAN_PATH}、${REVIEW_FILE_PATH} を文脈として読んでください。`,
				"不要ファイルや生成物を盲目的に commit せず、必要なら除外または未 commit として明記してください。",
				`現在の working tree 要約:\n\n${workTreeSummary}`,
				"実際に git commit を作成してください。",
				"完了後は 'COMMITS:' という見出しを含め、各 commit を short SHA と subject 付きの箇条書きで出力してください。",
			].join("\n\n"),
		);
		await writeText(repoPath(repoRoot, COMMITS_PATH), `${commitText.trimEnd()}\n`);
		await saveMeta(repoRoot, { commitsRecordedAt: new Date().toISOString(), commitAgent: DEFAULT_CONFIG.commitAgent });
		return { commitsPath: COMMITS_PATH };
	};
}

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

export function createPrMonitorHandler(repoRoot: string, activeDir: string) {
	return async () => {
		const meta = await loadMeta(repoRoot);
		const prUrl = typeof meta.prUrl === "string" ? meta.prUrl : null;
		if (!prUrl) {
			throw new Error("PR URL not found in metadata. Create the PR before monitoring it.");
		}

		const pr = await runGhJson<PullRequestView>(
			["pr", "view", prUrl, "--json", "url,title,state,mergedAt,updatedAt,comments,reviews"],
			repoRoot,
		);
		const checks = await runGhJson<PrCheck[]>(
			["pr", "checks", prUrl, "--json", "bucket,completedAt,description,link,name,state,workflow"],
			repoRoot,
		);
		const fingerprint = commentFingerprint(pr);
		const currentCycleCompleted = hasCompletedCurrentPrCycle(meta);
		const hasCheckActivity = checks.length > 0;
		const allChecksComplete = hasCheckActivity && checks.every((check) => !isPendingCheck(check));
		const previousItems = parseFingerprint(meta.prPendingCommentFingerprint);
		const viewerLogin = await getViewerLogin(repoRoot);
		const changedItems = diffFingerprintItems(previousItems, fingerprintItems(pr));
		const autoReplyTargets = collectAutoReplyTargets(pr, previousItems, viewerLogin);
		const basePatch = {
			prMonitorAgent: DEFAULT_CONFIG.prMonitorAgent,
			prMonitoredAt: new Date().toISOString(),
			prMonitorPath: PR_MONITOR_PATH,
			prLastCommentFingerprint: fingerprint,
		};

		if (pr.mergedAt || pr.state === "MERGED") {
			const monitorText = createPrMonitorMarkdown(pr, checks, "COMPLETED", "PR は merge 済みです。workflow を完了します。");
			await writeText(repoPath(repoRoot, PR_MONITOR_PATH), `${monitorText.trimEnd()}\n`);
			await saveMeta(repoRoot, {
				...basePatch,
				prUrl: null,
				prMonitorDisposition: "COMPLETED",
				prMonitorNextAction: "COMPLETED",
			});
			return { prMonitorPath: PR_MONITOR_PATH, disposition: "COMPLETED", nextAction: "COMPLETED", prUrl };
		}

		if (isClosedUnmergedPr(pr)) {
			const monitorText = createPrMonitorMarkdown(
				pr,
				checks,
				"REVIEW_REJECTED",
				"PR が close されており open PR は存在しないものとして扱います。必要なら再実装後に新規 PR を作成してください。",
			);
			await writeText(repoPath(repoRoot, PR_MONITOR_PATH), `${monitorText.trimEnd()}\n`);
			await saveMeta(repoRoot, {
				...basePatch,
				prUrl: null,
				prMonitorDisposition: "ACTION_REQUIRED",
				prMonitorNextAction: "REVIEW_REJECTED",
			});
			throw new Error("pr monitor detected closed unmerged PR; open PR required");
		}

		if (!currentCycleCompleted && !allChecksComplete) {
			const reason = hasCheckActivity
				? "workflow がまだ完了していないため、待機後に再確認します。"
				: "最新の PR 更新に対する check がまだ観測されていないため、待機後に再確認します。";
			const monitorText = createPrMonitorMarkdown(pr, checks, "WAIT", reason);
			await writeText(repoPath(repoRoot, PR_MONITOR_PATH), `${monitorText.trimEnd()}\n`);
			await saveMeta(repoRoot, {
				...basePatch,
				prMonitorDisposition: "PENDING",
				prMonitorNextAction: "WAIT",
				prPendingCommentFingerprint: fingerprint,
			});
			return { prMonitorPath: PR_MONITOR_PATH, disposition: "PENDING", nextAction: "WAIT", prUrl };
		}

		const reviewHistory = await readTextIfExists(repoPath(repoRoot, REVIEW_FILE_PATH));
		if (changedItems.length > 0) {
			const judgement = await judgePrFeedbackWithAgent(repoRoot, activeDir, prUrl, reviewHistory, previousItems, changedItems);
			if (judgement.decision === "REVIEW_REJECTED") {
				await appendRejectedReviewFromPr(repoRoot, pr);
				const monitorText = createPrMonitorMarkdown(pr, checks, "REVIEW_REJECTED", judgement.note);
				await writeText(repoPath(repoRoot, PR_MONITOR_PATH), `${monitorText.trimEnd()}\n`);
				await saveMeta(repoRoot, {
					...basePatch,
					prMonitorDisposition: "ACTION_REQUIRED",
					prMonitorNextAction: "REVIEW_REJECTED",
					latestReviewFile: REVIEW_FILE_PATH,
					latestReviewDisposition: "REJECTED",
				});
				throw new Error(`pr monitor detected new review comments: see ${REVIEW_FILE_PATH}`);
			}

			if (judgement.replyNeeded && autoReplyTargets.length > 0) {
				for (const target of autoReplyTargets) {
					await postPrComment(repoRoot, prUrl, createAutoReplyBody(target, reviewHistory));
				}
				const monitorText = createPrMonitorMarkdown(
					pr,
					checks,
					"USER_CONFIRM",
					`${autoReplyTargets.length} 件のコメントに review markdown を参照して返信しました。${judgement.note}`,
				);
				await writeText(repoPath(repoRoot, PR_MONITOR_PATH), `${monitorText.trimEnd()}\n`);
				await saveMeta(repoRoot, {
					...basePatch,
					prMonitorDisposition: "OK",
					prMonitorNextAction: "USER_CONFIRM",
					prPendingCommentFingerprint: fingerprint,
					prWorkflowCompletedAt: typeof meta.prWorkflowCompletedAt === "string" ? meta.prWorkflowCompletedAt : new Date().toISOString(),
				});
				return { prMonitorPath: PR_MONITOR_PATH, disposition: "OK", nextAction: "USER_CONFIRM", prUrl };
			}
		}

		const monitorText = createPrMonitorMarkdown(
			pr,
			checks,
			"USER_CONFIRM",
			"workflow は完了しており、必要なコメント対応も完了しているため、ユーザー確認待ちです。",
		);
		await writeText(repoPath(repoRoot, PR_MONITOR_PATH), `${monitorText.trimEnd()}\n`);
		await saveMeta(repoRoot, {
			...basePatch,
			prMonitorDisposition: checks.some((check) => ["fail", "cancel"].includes(check.bucket ?? "")) ? "ACTION_REQUIRED" : "OK",
			prMonitorNextAction: "USER_CONFIRM",
			prPendingCommentFingerprint: fingerprint,
			prWorkflowCompletedAt: typeof meta.prWorkflowCompletedAt === "string" ? meta.prWorkflowCompletedAt : new Date().toISOString(),
		});
		return { prMonitorPath: PR_MONITOR_PATH, disposition: "OK", nextAction: "USER_CONFIRM", prUrl };
	};
}

export function createPrMonitorWaitHandler(pi: ExtensionAPI, repoRoot: string) {
	return async () => {
		const meta = await loadMeta(repoRoot);
		const nextAction = typeof meta.prMonitorNextAction === "string" ? (meta.prMonitorNextAction as PrMonitorNextAction) : "WAIT";
		const prUrl = typeof meta.prUrl === "string" && meta.prUrl ? meta.prUrl : null;
		if (nextAction === "WAIT") {
			await new Promise((resolve) => setTimeout(resolve, PR_MONITOR_WAIT_MS));
			throw new Error("retry pr monitor after wait");
		}
		if (nextAction === "COMPLETED") {
			pi.sendUserMessage(
				[
					"GitHub issue driven dev workflow: PR は merge 済みです。",
					`${PR_MONITOR_PATH} を確認し、必要なら PR 状態を再確認してください。`,
				].join("\n"),
				{ deliverAs: "followUp" },
			);
			return { nextAction };
		}
		if (nextAction === "USER_CONFIRM") {
			if (!prUrl) {
				throw new Error("pr monitor user confirm requires an open PR");
			}
			return { nextAction };
		}
		return { nextAction };
	};
}
