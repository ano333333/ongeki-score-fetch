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
import { runGhJson } from "../command.ts";
import { ensureDir, readTextIfExists, writeText } from "../io.ts";
import { loadMeta, saveMeta } from "../meta.ts";
import { repoPath } from "../paths.ts";
import { runDelegatedAgent } from "../subagent.ts";

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

function commentFingerprint(pr: PullRequestView): string {
	const items = [
		...(pr.comments ?? []).map((comment) => ({
			kind: "comment",
			author: comment.author?.login ?? "",
			body: comment.body ?? "",
			createdAt: comment.createdAt ?? "",
			updatedAt: comment.updatedAt ?? "",
			url: comment.url ?? "",
		})),
		...(pr.reviews ?? []).map((review) => ({
			kind: "review",
			author: review.author?.login ?? "",
			body: review.body ?? "",
			state: review.state ?? "",
			submittedAt: review.submittedAt ?? "",
			updatedAt: review.updatedAt ?? "",
			url: review.url ?? "",
		})),
	];
	return JSON.stringify(items);
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

export function createCommitHandler(repoRoot: string, activeDir: string) {
	return async () => {
		const commitText = await runDelegatedAgent(
			repoRoot,
			DEFAULT_CONFIG.commitAgent,
			[
				"現在の workflow 変更を、意味のある単位の git commit にまとめてください。",
				`Repository root: ${repoRoot}`,
				`Workflow directory: ${activeDir}`,
				`必ず ${ISSUE_PATH}、${PLAN_PATH}、${REVIEW_FILE_PATH} を文脈として読んでください。`,
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
			await writeText(repoPath(repoRoot, PR_PATH), `PR_URL: ${existingMetaUrl}\n\n既存の PR を metadata から再利用しました。\n`);
			await saveMeta(repoRoot, {
				prUrl: existingMetaUrl,
				prSkippedAt: new Date().toISOString(),
				prAgent: DEFAULT_CONFIG.prAgent,
			});
			return { prPath: PR_PATH, prUrl: existingMetaUrl, skipped: true };
		}

		try {
			const existingPr = await runGhJson<{ url: string }>(["pr", "view", "--json", "url"], repoRoot);
			if (existingPr.url) {
				await writeText(repoPath(repoRoot, PR_PATH), `PR_URL: ${existingPr.url}\n\n既存の PR を再利用しました。\n`);
				await saveMeta(repoRoot, {
					prUrl: existingPr.url,
					prSkippedAt: new Date().toISOString(),
					prAgent: DEFAULT_CONFIG.prAgent,
				});
				return { prPath: PR_PATH, prUrl: existingPr.url, skipped: true };
			}
		} catch {
			// no existing PR for this branch; create one below
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
		const allChecksComplete = checks.every((check) => (check.bucket ?? "pass") !== "pending");
		const pendingFingerprint = typeof meta.prPendingCommentFingerprint === "string" ? meta.prPendingCommentFingerprint : null;
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
				prMonitorDisposition: "COMPLETED",
				prMonitorNextAction: "COMPLETED",
			});
			return { prMonitorPath: PR_MONITOR_PATH, disposition: "COMPLETED", nextAction: "COMPLETED", prUrl };
		}

		if (!allChecksComplete) {
			const monitorText = createPrMonitorMarkdown(pr, checks, "WAIT", "workflow がまだ完了していないため、待機後に再確認します。");
			await writeText(repoPath(repoRoot, PR_MONITOR_PATH), `${monitorText.trimEnd()}\n`);
			await saveMeta(repoRoot, {
				...basePatch,
				prMonitorDisposition: "PENDING",
				prMonitorNextAction: "WAIT",
				prPendingCommentFingerprint: fingerprint,
			});
			return { prMonitorPath: PR_MONITOR_PATH, disposition: "PENDING", nextAction: "WAIT", prUrl };
		}

		if (pendingFingerprint && pendingFingerprint !== fingerprint) {
			await appendRejectedReviewFromPr(repoRoot, pr);
			const monitorText = createPrMonitorMarkdown(
				pr,
				checks,
				"REVIEW_REJECTED",
				"workflow 完了前と比較して PR コメントまたは review が変化したため、review 差し戻しへ戻します。",
			);
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

		const monitorText = createPrMonitorMarkdown(
			pr,
			checks,
			"USER_CONFIRM",
			"workflow は完了しており、workflow 完了前からコメント変化もないため、ユーザー確認待ちです。",
		);
		await writeText(repoPath(repoRoot, PR_MONITOR_PATH), `${monitorText.trimEnd()}\n`);
		await saveMeta(repoRoot, {
			...basePatch,
			prMonitorDisposition: checks.some((check) => ["fail", "cancel"].includes(check.bucket ?? "")) ? "ACTION_REQUIRED" : "OK",
			prMonitorNextAction: "USER_CONFIRM",
			prWorkflowCompletedAt: typeof meta.prWorkflowCompletedAt === "string" ? meta.prWorkflowCompletedAt : new Date().toISOString(),
		});
		return { prMonitorPath: PR_MONITOR_PATH, disposition: "OK", nextAction: "USER_CONFIRM", prUrl };
	};
}

export function createPrMonitorWaitHandler(pi: ExtensionAPI, repoRoot: string) {
	return async () => {
		const meta = await loadMeta(repoRoot);
		const nextAction = typeof meta.prMonitorNextAction === "string" ? (meta.prMonitorNextAction as PrMonitorNextAction) : "WAIT";
		if (nextAction === "WAIT") {
			await new Promise((resolve) => setTimeout(resolve, PR_MONITOR_WAIT_MS));
			throw new Error("retry pr monitor after wait");
		}
		if (nextAction === "COMPLETED") {
			pi.sendUserMessage("GitHub issue driven dev workflow: PR は merge 済みです。workflow は完了しました。", {
				deliverAs: "followUp",
			});
			return { nextAction };
		}
		if (nextAction === "USER_CONFIRM") {
			pi.sendUserMessage(
				[
					"GitHub issue driven dev workflow: PR の workflow は完了しています。",
					`${PR_MONITOR_PATH} を読み、PR の最終状態を確認してください。`,
					"コメント変化は検出されていないため、ここから先はユーザー確認待ちです。",
				].join("\n"),
				{ deliverAs: "followUp" },
			);
			return { nextAction };
		}
		return { nextAction };
	};
}
