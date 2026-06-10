import { META_PATH } from "./constants.ts";
import { readJson, writeJson } from "./io.ts";
import { repoPath } from "./paths.ts";

export type PrMonitorNextAction = "WAIT" | "USER_CONFIRM" | "COMPLETED" | "REVIEW_REJECTED";

export type ReviewDisposition = "ACCEPTED" | "REJECTED";

export type LatestReviewDisposition = ReviewDisposition | "UNKNOWN";

export type PrMonitorDisposition = "COMPLETED" | "ACTION_REQUIRED" | "PENDING" | "OK";

export interface WorkflowMeta {
	workflowId?: string;
	repo?: string;
	selectedAt?: string | null;
	issueNumber?: number | null;
	issueTitle?: string | null;
	issueUrl?: string | null;
	reviewAgent?: string;
	commitAgent?: string;
	prAgent?: string;
	prMonitorAgent?: string;
	selectionRequestedAt?: string;
	selectionRequest?: string | null;
	selectionRequestedIssueNumber?: number | null;
	selectionOverridesDefaultCriteria?: boolean;
	selectionRequestPath?: string;
	issueCandidatesPath?: string;
	commitsRecordedAt?: string;
	prUrl?: string | null;
	prSkippedAt?: string;
	prPushedAt?: string;
	prPushedBranch?: string;
	prWorkflowCompletedAt?: string | null;
	prMonitorDisposition?: PrMonitorDisposition;
	prMonitorNextAction?: PrMonitorNextAction;
	prCreatedAt?: string;
	latestReviewFile?: string;
	latestReviewDisposition?: LatestReviewDisposition;
	reviewUpdatedAt?: string;
	prMonitoredAt?: string;
	prMonitorPath?: string;
	prPendingCommentFingerprint?: string;
	formatterExitCode?: number;
	formatterRanAt?: string;
	linterExitCode?: number;
	linterRanAt?: string;
	testExitCode?: number;
	testRanAt?: string;
}

export async function loadMeta(repoRoot: string): Promise<WorkflowMeta> {
	return (await readJson<WorkflowMeta>(repoPath(repoRoot, META_PATH))) ?? {};
}

export async function saveMeta(repoRoot: string, patch: Partial<WorkflowMeta>): Promise<void> {
	const current = await loadMeta(repoRoot);
	await writeJson(repoPath(repoRoot, META_PATH), { ...current, ...patch });
}
