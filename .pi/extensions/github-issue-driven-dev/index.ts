import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	ACTIVE_RUN_DIR,
	PENDING_SELECTION_REQUEST_PATH,
	REGISTER_FUNCTION_HANDLER_EVENT,
	REGISTER_WORKFLOW_EVENT,
	REVIEWS_DIR,
	START_WORKFLOW_EVENT,
	WORKFLOW_ID,
} from "./constants.ts";
import { createCommitHandler } from "./handlers/commit.ts";
import { createPrHandler } from "./handlers/create-pr.ts";
import { createPrMonitorHandler, createPrMonitorWaitHandler } from "./handlers/monitor-pr.ts";
import { createQueuedUserMessageHandler } from "./handlers/prompt-user-message.ts";
import { createReviewHandler } from "./handlers/review.ts";
import { createSelectIssueHandler } from "./handlers/select-issue.ts";
import { createFormatterHandler, createLinterHandler, createTestHandler } from "./handlers/verification.ts";
import { writeText } from "./io.ts";
import { loadMeta } from "./meta.ts";
import { findProjectRoot, repoPath } from "./paths.ts";
import { promptAddressReview, promptFixLinter, promptFixTest, promptImplement } from "./prompts.ts";
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
			handler: createQueuedUserMessageHandler(pi, promptImplement()),
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
			handler: createQueuedUserMessageHandler(pi, promptFixLinter()),
		});
		registerHandler({
			name: "githubIssueDrivenDev.promptFixTest",
			handler: createQueuedUserMessageHandler(pi, promptFixTest()),
		});
		registerHandler({
			name: "githubIssueDrivenDev.promptAddressReview",
			handler: createQueuedUserMessageHandler(pi, promptAddressReview()),
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
