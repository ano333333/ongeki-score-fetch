import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	ISSUE_CANDIDATES_PATH,
	ISSUE_PATH,
	META_PATH,
	PENDING_SELECTION_REQUEST_PATH,
	REVIEWS_DIR,
	SELECTION_PATH,
	SELECTION_REQUEST_PATH,
	WORKFLOW_ID,
} from "../constants.ts";
import { ensureDir, readTextIfExists, resetDir, writeText } from "../io.ts";
import {
	formatIssueCandidatesMarkdown,
	formatSelectionRequestMarkdown,
	listOpenIssues,
	parseSelectionRequest,
} from "../issue-selection.ts";
import { saveMeta } from "../meta.ts";
import { repoPath } from "../paths.ts";
import { loadProjectConfig } from "../project-config.ts";

export function createSelectIssueHandler(pi: ExtensionAPI, repoRoot: string, activeDir: string) {
	const reviewsDir = repoPath(repoRoot, REVIEWS_DIR);
	const pendingRequestPath = repoPath(repoRoot, PENDING_SELECTION_REQUEST_PATH);
	return async () => {
		const config = await loadProjectConfig(repoRoot);
		const requestText = (await readTextIfExists(pendingRequestPath)).trim();
		await resetDir(activeDir);
		await ensureDir(reviewsDir);
		const { repo, issues } = await listOpenIssues(repoRoot, config);
		const parsedRequest = parseSelectionRequest(requestText);
		const saveSelectionMeta = async () =>
			await saveMeta(repoRoot, {
				workflowId: WORKFLOW_ID,
				repo,
				selectedAt: null,
				issueNumber: null,
				issueTitle: null,
				issueUrl: null,
				reviewAgent: config.reviewAgent,
				commitAgent: config.commitAgent,
				prAgent: config.prAgent,
				prMonitorAgent: config.prMonitorAgent,
				selectionRequestedAt: new Date().toISOString(),
				selectionRequest: requestText || null,
				selectionRequestedIssueNumber: parsedRequest.explicitIssueNumber,
				selectionOverridesDefaultCriteria: parsedRequest.overridesDefaultCriteria,
				selectionRequestPath: SELECTION_REQUEST_PATH,
				issueCandidatesPath: ISSUE_CANDIDATES_PATH,
			});
		await writeText(repoPath(repoRoot, SELECTION_REQUEST_PATH), formatSelectionRequestMarkdown(requestText));
		await writeText(repoPath(repoRoot, ISSUE_CANDIDATES_PATH), formatIssueCandidatesMarkdown(repo, issues));
		if (issues.length === 0) {
			await saveSelectionMeta();
			await writeText(pendingRequestPath, "");
			throw new Error(`no open issues found for ${repo}`);
		}
		await saveSelectionMeta();
		await writeText(pendingRequestPath, "");
		const message = [
			"GitHub issue driven dev workflow: issue選定フェーズです。",
			`${SELECTION_REQUEST_PATH} を読んでください。`,
			`${ISSUE_CANDIDATES_PATH} を読んでください。`,
			"要求に最も合う issue をちょうど 1 件選んでください。要求が空または曖昧な場合は、元の基準を優先してください: 高優先度ラベル、assignee なし、blocker ラベルなし、本文中に 'blocked by #123' や 'depends on #123' のように書かれた open な依存 issue がないこと。",
			`選んだ issue の内容を ${ISSUE_PATH} に書いてください。`,
			`選定理由と要約を ${SELECTION_PATH} に書いてください。明示要求で既定基準を上書きした場合は、その理由も書いてください。`,
			`${META_PATH} には初期 metadata を作成済みです。選んだ issue に合わせて issueNumber, issueTitle, issueUrl, selectedAt を必ず更新してください。最低限 workflowId, repo, issueNumber, issueTitle, issueUrl, selectedAt を含めてください。workflowId=\"${WORKFLOW_ID}\" を使ってください。`,
			"ファイルを作成し終えたら停止し、ユーザーが手動で workflow を進めるのを待ってください。",
		].join("\n");
		pi.sendUserMessage(message, { deliverAs: "steer" });
		return {
			repo,
			issueCandidatesPath: ISSUE_CANDIDATES_PATH,
			selectionRequestPath: SELECTION_REQUEST_PATH,
			selectionRequestedIssueNumber: parsedRequest.explicitIssueNumber,
			issueCount: issues.length,
		};
	};
}
