import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	ACTIVE_RUN_DIR,
	PENDING_SELECTION_REQUEST_PATH,
	REGISTER_FUNCTION_HANDLER_EVENT,
	REGISTER_WORKFLOW_EVENT,
	REVIEW_FILE_PATH,
	START_WORKFLOW_EVENT,
	WORKFLOW_ID,
	REVIEWS_DIR,
} from "./constants.ts";
import { createCommitHandler, createPrHandler, createPrMonitorHandler, createPrMonitorWaitHandler } from "./handlers/commit-pr.ts";
import { createQueuedUserMessageHandler } from "./handlers/prompt-user-message.ts";
import { createReviewHandler } from "./handlers/review.ts";
import { createSelectIssueHandler } from "./handlers/select-issue.ts";
import { createFormatterHandler, createLinterHandler, createTestHandler } from "./handlers/verification.ts";
import { writeText } from "./io.ts";
import { loadMeta } from "./meta.ts";
import { findProjectRoot, repoPath } from "./paths.ts";
import type { RegisterFunctionHandlerPayload, StartWorkflowPayload } from "./types.ts";
import { workflowDefinition } from "./workflow.ts";

export default function githubIssueDrivenDevExtension(pi: ExtensionAPI): void {
	const repoRoot = findProjectRoot(process.cwd());
	const activeDir = repoPath(repoRoot, ACTIVE_RUN_DIR);
	const reviewsDir = repoPath(repoRoot, REVIEWS_DIR);

	const registerHandler = (payload: RegisterFunctionHandlerPayload): void => {
		pi.events.emit(REGISTER_FUNCTION_HANDLER_EVENT, payload);
	};

	const registerSelf = (): void => {
		registerHandler({
			name: "githubIssueDrivenDev.selectIssue",
			handler: createSelectIssueHandler(pi, repoRoot, activeDir),
		});
		registerHandler({
			name: "githubIssueDrivenDev.runFormatter",
			handler: createFormatterHandler(repoRoot),
		});
		registerHandler({
			name: "githubIssueDrivenDev.promptImplement",
			handler: createQueuedUserMessageHandler(
				pi,
				[
					"GitHub issue driven dev workflow: 実装フェーズです。",
					".pi/workflows/github-issue-driven-dev/current/ISSUE.md と .pi/workflows/github-issue-driven-dev/current/PLAN.md を読んでください。",
					"このフローは追加の skill ではなく、pi + state-workflow の state と handler を中心に進みます。",
					"選ばれた issue に必要な範囲だけ実装してください。",
					"必要に応じてファイル調査、コード編集、コマンド実行を行って構いません。",
					"実装の最後に git status を確認し、不要ファイルや意図しない生成物（不要ログ、tmp、untracked build artifact など）を残さないでください。",
					"重要な判断があれば、セッションに有用な reasoning を残してください。",
					"この実装フェーズでは、ここで行った変更を review フェーズに渡せる状態まで整えることが目的です。PR 作成や PR 監視は後続 state で行われます。",
					"レビュー通過後は PR 作成に加えて .pi/workflows/github-issue-driven-dev/current/PR_MONITOR.md へ GitHub Actions / CodeRabbit の監視結果も残る前提で進めてください。",
					"レビューに進むには、実装が一区切りついた時点で workflow_next tool を transitionId: to-run-formatter で呼び、formatter 実行へ進んでください。",
				].join("\n"),
			),
		});
		registerHandler({
			name: "githubIssueDrivenDev.runLinter",
			handler: createLinterHandler(repoRoot),
		});
		registerHandler({
			name: "githubIssueDrivenDev.runTest",
			handler: createTestHandler(repoRoot),
		});
		registerHandler({
			name: "githubIssueDrivenDev.promptFixLinter",
			handler: createQueuedUserMessageHandler(
				pi,
				[
					"GitHub issue driven dev workflow: linter に失敗しました。",
					".pi/workflows/github-issue-driven-dev/current/linter.log の出力を読んでください。",
					"スコープを広げずに lint エラーを修正してください。",
					"修正後は、formatter/linter/test/review を自動で流すため、workflow_next tool を transitionId: retry-formatter-after-lint で呼んで formatter に戻してください。",
				].join("\n"),
			),
		});
		registerHandler({
			name: "githubIssueDrivenDev.promptFixTest",
			handler: createQueuedUserMessageHandler(
				pi,
				[
					"GitHub issue driven dev workflow: test に失敗しました。",
					".pi/workflows/github-issue-driven-dev/current/test.log の出力を読んでください。",
					"失敗しているテスト、またはその原因となっている実装バグを修正してください。",
					"修正後は、formatter/linter/test/review を自動で流すため、workflow_next tool を transitionId: retry-formatter-after-test で呼んで formatter に戻してください。",
				].join("\n"),
			),
		});
		registerHandler({
			name: "githubIssueDrivenDev.promptAddressReview",
			handler: createQueuedUserMessageHandler(
				pi,
				[
					"GitHub issue driven dev workflow: review で差し戻されました。",
					`${REVIEW_FILE_PATH} を読んでください。`,
					"そのファイルの最新の REJECTED 指摘に対応し、修正内容も同じ review ファイルに追記してください。",
					"指摘事項を修正した後、formatter/linter/test/review を自動で再実行するため、workflow_next tool を transitionId: retry-formatter-after-review で呼んで formatter に戻してください。",
				].join("\n"),
			),
		});
		registerHandler({
			name: "githubIssueDrivenDev.review",
			handler: createReviewHandler(repoRoot, activeDir, reviewsDir),
		});
		registerHandler({
			name: "githubIssueDrivenDev.commit",
			handler: createCommitHandler(repoRoot, activeDir),
		});
		registerHandler({
			name: "githubIssueDrivenDev.createPr",
			handler: createPrHandler(repoRoot, activeDir),
		});
		registerHandler({
			name: "githubIssueDrivenDev.monitorPr",
			handler: createPrMonitorHandler(repoRoot, activeDir),
		});
		registerHandler({
			name: "githubIssueDrivenDev.waitPrMonitor",
			handler: createPrMonitorWaitHandler(pi, repoRoot),
		});
		pi.events.emit(REGISTER_WORKFLOW_EVENT, workflowDefinition);
	};

	pi.on("session_start", async () => {
		registerSelf();
	});

	pi.registerCommand("issue-driven-dev-start", {
		description: "Start the github-issue-driven-dev workflow",
		handler: async (args, ctx) => {
			const requestText = Array.isArray(args) ? args.join(" ").trim() : typeof args === "string" ? args.trim() : String(args ?? "").trim();
			await writeText(repoPath(repoRoot, PENDING_SELECTION_REQUEST_PATH), requestText);
			registerSelf();
			pi.events.emit(START_WORKFLOW_EVENT, {
				workflowId: WORKFLOW_ID,
				autoRun: true,
				ctx,
			} satisfies StartWorkflowPayload);
		},
	});

	pi.registerCommand("issue-driven-dev-open-dir", {
		description: "Show the workflow working directory",
		handler: async (_args, ctx) => {
			const meta = await loadMeta(repoRoot);
			ctx.ui.notify(`Workflow dir: ${activeDir}\nIssue: ${String(meta.issueNumber ?? "<none>")}`, "info");
		},
	});

	registerSelf();
}
