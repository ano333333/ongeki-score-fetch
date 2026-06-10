import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runGhJson } from "../command.ts";
import { DEFAULT_CONFIG, PR_MONITOR_PATH, PR_MONITOR_WAIT_MS, REVIEW_FILE_PATH } from "../constants.ts";
import { ensureDir, readTextIfExists, writeText } from "../io.ts";
import type { PrMonitorNextAction, WorkflowMeta } from "../meta.ts";
import { loadMeta, saveMeta } from "../meta.ts";
import { repoPath } from "../paths.ts";
import { collectAutoReplyTargets, createAutoReplyBody, getViewerLogin, postPrComment } from "../pr/auto-reply.ts";
import { commentFingerprint, diffFingerprintItems, fingerprintItems, parseFingerprint } from "../pr/fingerprint.ts";
import { judgePrFeedbackWithAgent } from "../pr/judgement.ts";
import { createPrMonitorMarkdown, summarizeReviewFeedback } from "../pr/markdown.ts";
import type { PrCheck, PullRequestStatusView, PullRequestView } from "../pr/view.ts";
import { isClosedUnmergedPr, isPendingCheck } from "../pr/view.ts";

export function parseIsoTimestamp(value: unknown): number | null {
	if (typeof value !== "string" || !value) return null;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? null : parsed;
}

export function getLatestPrCycleStartedAt(meta: WorkflowMeta): number | null {
	const candidates = [parseIsoTimestamp(meta.prCreatedAt), parseIsoTimestamp(meta.prPushedAt)].filter(
		(value): value is number => value !== null,
	);
	if (candidates.length === 0) return null;
	return Math.max(...candidates);
}

export function hasCompletedCurrentPrCycle(meta: WorkflowMeta): boolean {
	const completedAt = parseIsoTimestamp(meta.prWorkflowCompletedAt);
	if (completedAt === null) return false;
	const latestCycleStartedAt = getLatestPrCycleStartedAt(meta);
	if (latestCycleStartedAt === null) return true;
	return completedAt >= latestCycleStartedAt;
}

export function countReviewRounds(reviewHistory: string): number {
	return (reviewHistory.match(/^## Review Round /gm) ?? []).length;
}

export async function appendRejectedReviewFromPr(repoRoot: string, pr: PullRequestView): Promise<void> {
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

export function createPrMonitorHandler(repoRoot: string, activeDir: string) {
	return async () => {
		const meta = await loadMeta(repoRoot);
		const prUrl = meta.prUrl ?? null;
		if (!prUrl) {
			throw new Error("PR URL not found in metadata. Create the PR before monitoring it.");
		}

		const prStatus = await runGhJson<PullRequestStatusView>(
			["pr", "view", prUrl, "--json", "url,title,state,mergedAt,updatedAt"],
			repoRoot,
		);
		const checks = await runGhJson<PrCheck[]>(
			["pr", "checks", prUrl, "--json", "bucket,completedAt,description,link,name,state,workflow"],
			repoRoot,
		);
		const currentCycleCompleted = hasCompletedCurrentPrCycle(meta);
		const hasCheckActivity = checks.length > 0;
		const allChecksComplete = hasCheckActivity && checks.every((check) => !isPendingCheck(check));
		const basePatch = {
			prMonitorAgent: DEFAULT_CONFIG.prMonitorAgent,
			prMonitoredAt: new Date().toISOString(),
			prMonitorPath: PR_MONITOR_PATH,
		};

		if (prStatus.mergedAt || prStatus.state === "MERGED") {
			const monitorText = createPrMonitorMarkdown(prStatus, checks, "COMPLETED", "PR は merge 済みです。workflow を完了します。");
			await writeText(repoPath(repoRoot, PR_MONITOR_PATH), `${monitorText.trimEnd()}\n`);
			await saveMeta(repoRoot, {
				...basePatch,
				prUrl: null,
				prMonitorDisposition: "COMPLETED",
				prMonitorNextAction: "COMPLETED",
			});
			return { prMonitorPath: PR_MONITOR_PATH, disposition: "COMPLETED", nextAction: "COMPLETED", prUrl };
		}

		if (isClosedUnmergedPr(prStatus)) {
			const monitorText = createPrMonitorMarkdown(
				prStatus,
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
			const monitorText = createPrMonitorMarkdown(prStatus, checks, "WAIT", reason);
			await writeText(repoPath(repoRoot, PR_MONITOR_PATH), `${monitorText.trimEnd()}\n`);
			await saveMeta(repoRoot, {
				...basePatch,
				prMonitorDisposition: "PENDING",
				prMonitorNextAction: "WAIT",
			});
			return { prMonitorPath: PR_MONITOR_PATH, disposition: "PENDING", nextAction: "WAIT", prUrl };
		}

		const pr = await runGhJson<PullRequestView>(
			["pr", "view", prUrl, "--json", "url,title,state,mergedAt,updatedAt,comments,reviews"],
			repoRoot,
		);
		const fingerprint = commentFingerprint(pr);
		const previousItems = parseFingerprint(meta.prPendingCommentFingerprint);
		const viewerLogin = await getViewerLogin(repoRoot);
		const changedItems = diffFingerprintItems(previousItems, fingerprintItems(pr));
		const autoReplyTargets = collectAutoReplyTargets(pr, previousItems, viewerLogin);
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
					prWorkflowCompletedAt: meta.prWorkflowCompletedAt ?? new Date().toISOString(),
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
			prWorkflowCompletedAt: meta.prWorkflowCompletedAt ?? new Date().toISOString(),
		});
		return { prMonitorPath: PR_MONITOR_PATH, disposition: "OK", nextAction: "USER_CONFIRM", prUrl };
	};
}

export function createPrMonitorWaitHandler(pi: ExtensionAPI, repoRoot: string) {
	return async () => {
		const meta = await loadMeta(repoRoot);
		const nextAction: PrMonitorNextAction = meta.prMonitorNextAction ?? "WAIT";
		const prUrl = meta.prUrl ?? null;
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
