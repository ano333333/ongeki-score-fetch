import { beforeEach, describe, expect, it, vi } from "vitest";
import { FORMATTER_LOG_PATH, LINTER_LOG_PATH, TEST_LOG_PATH } from "./constants.ts";
import { runCommandStreaming } from "./command.ts";
import { createFormatterHandler, createLinterHandler, createTestHandler } from "./handlers/verification.ts";
import { writeText } from "./io.ts";
import { saveMeta } from "./meta.ts";
import type { WorkflowFunctionContext } from "./types.ts";
import { workflowDefinition } from "./workflow.ts";

vi.mock("./command.ts", () => ({
	runCommandStreaming: vi.fn(),
}));

vi.mock("./meta.ts", () => ({
	saveMeta: vi.fn(),
	loadMeta: vi.fn(),
}));

vi.mock("./io.ts", () => ({
	writeText: vi.fn(),
	ensureDir: vi.fn(),
	resetDir: vi.fn(),
	readTextIfExists: vi.fn(),
	readJson: vi.fn(),
	writeJson: vi.fn(),
	listReviewFiles: vi.fn(),
}));

const repoRoot = "/repo";
const runCommandStreamingMock = vi.mocked(runCommandStreaming);
const saveMetaMock = vi.mocked(saveMeta);
const writeTextMock = vi.mocked(writeText);

function nextStateForResult(stateId: string, succeeded: boolean): string | null {
	const state = workflowDefinition.states[stateId];
	const trigger = succeeded ? "success" : "error";
	return state.transitions.find((transition) => transition.trigger === trigger)?.to ?? null;
}

function createHandlerContext(): WorkflowFunctionContext {
	return {
		run: {},
		session: { entries: [], leafId: null },
		reportProgress: vi.fn(),
	};
}

describe("github-issue-driven-dev verification workflow", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("run-formatter succeeds and advances to run-linter", async () => {
		runCommandStreamingMock
			.mockResolvedValueOnce({ exitCode: 0, stdout: "formatted chrome-extension", stderr: "" })
			.mockResolvedValueOnce({ exitCode: 0, stdout: "formatted gcp", stderr: "" })
			.mockResolvedValueOnce({ exitCode: 0, stdout: "formatted extensions", stderr: "" });

		const handler = createFormatterHandler(repoRoot);
		const context = createHandlerContext();
		await expect(handler(undefined, context)).resolves.toEqual({ logPath: FORMATTER_LOG_PATH });
		expect(runCommandStreamingMock).toHaveBeenCalledTimes(3);
		expect(context.reportProgress).toHaveBeenCalledWith("Running formatter for chrome-extension...");
		expect(nextStateForResult("run-formatter", true)).toBe("run-linter");
		expect(saveMetaMock).toHaveBeenCalledWith(repoRoot, expect.objectContaining({ formatterExitCode: 0 }));
		expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining(FORMATTER_LOG_PATH), expect.stringContaining("## chrome-extension"));
	});

	it("implement exposes an agent-selectable transition to run-formatter", () => {
		const state = workflowDefinition.states.implement;
		const transition = state.transitions.find((item) => item.id === "to-run-formatter");
		expect(transition?.trigger).toBe("manualOrAgent");
		expect(state.action.kind).toBe("function");
		if (state.action.kind !== "function") {
			throw new Error("implement action should be a function");
		}
		expect(state.action.handler).toBe("githubIssueDrivenDev.promptImplement");
	});

	it("run-formatter streams stdout and stderr progress", async () => {
		runCommandStreamingMock.mockImplementationOnce(async (_command, _cwd, options) => {
			options?.onStdout?.("line 1\nline 2\n");
			options?.onStderr?.("warn 1\n");
			return { exitCode: 0, stdout: "line 1\nline 2\n", stderr: "warn 1\n" };
		});
		runCommandStreamingMock.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });
		runCommandStreamingMock.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

		const handler = createFormatterHandler(repoRoot);
		const context = createHandlerContext();
		await handler(undefined, context);
		expect(context.reportProgress).toHaveBeenCalledWith("[chrome-extension] line 1");
		expect(context.reportProgress).toHaveBeenCalledWith("[chrome-extension] line 2");
		expect(context.reportProgress).toHaveBeenCalledWith("[chrome-extension] warn 1", "error");
	});

	it("run-formatter stops on failure and does not auto-advance", async () => {
		runCommandStreamingMock
			.mockResolvedValueOnce({ exitCode: 0, stdout: "formatted chrome-extension", stderr: "" })
			.mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "gcp failed" });

		const handler = createFormatterHandler(repoRoot);
		await expect(handler(undefined)).rejects.toThrow(`formatter failed: see ${FORMATTER_LOG_PATH}`);
		expect(runCommandStreamingMock).toHaveBeenCalledTimes(2);
		expect(nextStateForResult("run-formatter", false)).toBeNull();
		expect(saveMetaMock).toHaveBeenCalledWith(repoRoot, expect.objectContaining({ formatterExitCode: 1 }));
		expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining(FORMATTER_LOG_PATH), expect.stringContaining("gcp failed"));
	});

	it("run-linter succeeds and advances to run-test", async () => {
		runCommandStreamingMock
			.mockResolvedValueOnce({ exitCode: 0, stdout: "linted chrome-extension", stderr: "" })
			.mockResolvedValueOnce({ exitCode: 0, stdout: "linted gcp", stderr: "" })
			.mockResolvedValueOnce({ exitCode: 0, stdout: "linted extensions", stderr: "" });

		const handler = createLinterHandler(repoRoot);
		await expect(handler(undefined)).resolves.toEqual({ logPath: LINTER_LOG_PATH });
		expect(nextStateForResult("run-linter", true)).toBe("run-test");
	});

	it("run-linter failure routes to fix-linter", async () => {
		runCommandStreamingMock.mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "lint failed" });

		const handler = createLinterHandler(repoRoot);
		await expect(handler(undefined)).rejects.toThrow(`linter failed: see ${LINTER_LOG_PATH}`);
		expect(runCommandStreamingMock).toHaveBeenCalledTimes(1);
		expect(nextStateForResult("run-linter", false)).toBe("fix-linter");
	});

	it("fix-linter queues guidance through a function handler and exposes an agent-selectable retry transition", () => {
		const state = workflowDefinition.states["fix-linter"];
		const transition = state.transitions.find((item) => item.id === "retry-formatter-after-lint");
		expect(state.action.kind).toBe("function");
		if (state.action.kind !== "function") throw new Error("fix-linter action should be a function");
		expect(state.action.handler).toBe("githubIssueDrivenDev.promptFixLinter");
		expect(transition?.trigger).toBe("manualOrAgent");
	});

	it("run-test succeeds and advances to review", async () => {
		runCommandStreamingMock.mockResolvedValueOnce({ exitCode: 0, stdout: "tests passed", stderr: "" });

		const handler = createTestHandler(repoRoot);
		await expect(handler(undefined)).resolves.toEqual({ logPath: TEST_LOG_PATH });
		expect(nextStateForResult("run-test", true)).toBe("review");
	});

	it("run-test failure routes to fix-test", async () => {
		runCommandStreamingMock.mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "tests failed" });

		const handler = createTestHandler(repoRoot);
		await expect(handler(undefined)).rejects.toThrow(`test failed: see ${TEST_LOG_PATH}`);
		expect(nextStateForResult("run-test", false)).toBe("fix-test");
	});

	it("fix-test queues guidance through a function handler and exposes an agent-selectable retry transition", () => {
		const state = workflowDefinition.states["fix-test"];
		const transition = state.transitions.find((item) => item.id === "retry-formatter-after-test");
		expect(state.action.kind).toBe("function");
		if (state.action.kind !== "function") throw new Error("fix-test action should be a function");
		expect(state.action.handler).toBe("githubIssueDrivenDev.promptFixTest");
		expect(transition?.trigger).toBe("manualOrAgent");
	});

	it("review success advances to commit and failure routes to address-review", () => {
		expect(nextStateForResult("review", true)).toBe("commit");
		expect(nextStateForResult("review", false)).toBe("address-review");
	});

	it("address-review queues guidance through a function handler and exposes an agent-selectable retry transition", () => {
		const state = workflowDefinition.states["address-review"];
		const transition = state.transitions.find((item) => item.id === "retry-formatter-after-review");
		expect(state.action.kind).toBe("function");
		if (state.action.kind !== "function") throw new Error("address-review action should be a function");
		expect(state.action.handler).toBe("githubIssueDrivenDev.promptAddressReview");
		expect(transition?.trigger).toBe("manualOrAgent");
	});

	it("create-pr success advances to monitor-pr", () => {
		expect(nextStateForResult("create-pr", true)).toBe("monitor-pr");
	});

	it("monitor-pr success advances to wait-pr-monitor and failure routes to address-review", () => {
		expect(nextStateForResult("monitor-pr", true)).toBe("wait-pr-monitor");
		expect(nextStateForResult("monitor-pr", false)).toBe("address-review");
	});

	it("wait-pr-monitor retries monitor-pr on error and otherwise terminates", () => {
		expect(nextStateForResult("wait-pr-monitor", false)).toBe("monitor-pr");
		expect(nextStateForResult("wait-pr-monitor", true)).toBeNull();
		const state = workflowDefinition.states["wait-pr-monitor"];
		expect(state.action.kind).toBe("function");
		if (state.action.kind !== "function") throw new Error("wait-pr-monitor action should be a function");
		expect(state.action.handler).toBe("githubIssueDrivenDev.waitPrMonitor");
	});
});
