import { beforeEach, describe, expect, it, vi } from "vitest";
import { PR_MONITOR_PATH, REVIEW_FILE_PATH } from "./constants.ts";
import { createPrHandler, createPrMonitorHandler, createPrMonitorWaitHandler } from "./handlers/commit-pr.ts";
import { ensureDir, readTextIfExists, writeText } from "./io.ts";
import { loadMeta, saveMeta } from "./meta.ts";
import { runDelegatedAgent } from "./subagent.ts";
import { runCommand, runGhJson } from "./command.ts";

vi.mock("./subagent.ts", () => ({
	runDelegatedAgent: vi.fn(),
}));

vi.mock("./command.ts", () => ({
	runGhJson: vi.fn(),
	runCommandStreaming: vi.fn(),
	runCommand: vi.fn(),
	getPiInvocation: vi.fn(),
}));

vi.mock("./meta.ts", () => ({
	loadMeta: vi.fn(),
	saveMeta: vi.fn(),
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

describe("commit/pr handlers", () => {
	const repoRoot = "/repo";
	const activeDir = "/repo/.pi/workflows/github-issue-driven-dev/current";
	const loadMetaMock = vi.mocked(loadMeta);
	const saveMetaMock = vi.mocked(saveMeta);
	const writeTextMock = vi.mocked(writeText);
	const ensureDirMock = vi.mocked(ensureDir);
	const readTextIfExistsMock = vi.mocked(readTextIfExists);
	const runDelegatedAgentMock = vi.mocked(runDelegatedAgent);
	const runGhJsonMock = vi.mocked(runGhJson);
	const runCommandMock = vi.mocked(runCommand);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("pushes the current branch when metadata already has a PR URL", async () => {
		loadMetaMock.mockResolvedValue({ prUrl: "https://github.com/owner/repo/pull/123" });
		runCommandMock.mockResolvedValueOnce({ exitCode: 0, stdout: "feature/test\n", stderr: "" });
		runCommandMock.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

		const handler = createPrHandler(repoRoot, activeDir);
		await expect(handler()).resolves.toEqual({
			prPath: ".pi/workflows/github-issue-driven-dev/current/PR.md",
			prUrl: "https://github.com/owner/repo/pull/123",
			skipped: true,
			pushedBranch: "feature/test",
		});
		expect(runDelegatedAgentMock).not.toHaveBeenCalled();
		expect(runCommandMock).toHaveBeenNthCalledWith(1, "git branch --show-current", repoRoot);
		expect(runCommandMock).toHaveBeenNthCalledWith(2, "git push", repoRoot);
		expect(saveMetaMock).toHaveBeenCalledWith(
			repoRoot,
			expect.objectContaining({
				prUrl: "https://github.com/owner/repo/pull/123",
				prAgent: "issue-pr-author",
				prPushedBranch: "feature/test",
			}),
		);
	});

	it("pushes the current branch when gh detects an existing PR", async () => {
		loadMetaMock.mockResolvedValue({});
		runGhJsonMock.mockResolvedValueOnce({ url: "https://github.com/owner/repo/pull/123" });
		runCommandMock.mockResolvedValueOnce({ exitCode: 0, stdout: "feature/existing\n", stderr: "" });
		runCommandMock.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

		const handler = createPrHandler(repoRoot, activeDir);
		await expect(handler()).resolves.toEqual({
			prPath: ".pi/workflows/github-issue-driven-dev/current/PR.md",
			prUrl: "https://github.com/owner/repo/pull/123",
			skipped: true,
			pushedBranch: "feature/existing",
		});
		expect(runGhJsonMock).toHaveBeenCalledWith(["pr", "view", "--json", "url"], repoRoot);
		expect(runCommandMock).toHaveBeenNthCalledWith(1, "git branch --show-current", repoRoot);
		expect(runCommandMock).toHaveBeenNthCalledWith(2, "git push", repoRoot);
	});

	it("stores pending monitor output and asks the wait state to retry", async () => {
		loadMetaMock.mockResolvedValue({ prUrl: "https://github.com/owner/repo/pull/123" });
		runGhJsonMock
			.mockResolvedValueOnce({
				url: "https://github.com/owner/repo/pull/123",
				state: "OPEN",
				updatedAt: "2026-06-04T18:00:00Z",
				comments: [],
				reviews: [],
			})
			.mockResolvedValueOnce([{ name: "build", bucket: "pending", state: "IN_PROGRESS" }]);

		const handler = createPrMonitorHandler(repoRoot, activeDir);
		await expect(handler()).resolves.toEqual({
			prMonitorPath: PR_MONITOR_PATH,
			disposition: "PENDING",
			nextAction: "WAIT",
			prUrl: "https://github.com/owner/repo/pull/123",
		});
		expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining(PR_MONITOR_PATH), expect.stringContaining("PR_MONITOR: WAIT"));
		expect(saveMetaMock).toHaveBeenCalledWith(
			repoRoot,
			expect.objectContaining({ prMonitorDisposition: "PENDING", prMonitorNextAction: "WAIT" }),
		);
	});

	it("appends a rejected review when comments changed after workflow completion", async () => {
		loadMetaMock.mockResolvedValue({
			prUrl: "https://github.com/owner/repo/pull/123",
			prPendingCommentFingerprint: "[]",
		});
		readTextIfExistsMock.mockResolvedValue("# Review History\n\n## Review Round 1\n\nREVIEW: ACCEPTED\n");
		runGhJsonMock
			.mockResolvedValueOnce({
				url: "https://github.com/owner/repo/pull/123",
				state: "OPEN",
				updatedAt: "2026-06-04T18:10:00Z",
				comments: [{ author: { login: "coderabbit" }, body: "please fix this", updatedAt: "2026-06-04T18:09:00Z" }],
				reviews: [],
			})
			.mockResolvedValueOnce([{ name: "build", bucket: "pass", state: "SUCCESS" }]);

		const handler = createPrMonitorHandler(repoRoot, activeDir);
		await expect(handler()).rejects.toThrow(`pr monitor detected new review comments: see ${REVIEW_FILE_PATH}`);
		expect(ensureDirMock).toHaveBeenCalled();
		expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining(REVIEW_FILE_PATH), expect.stringContaining("REVIEW: REJECTED"));
		expect(saveMetaMock).toHaveBeenCalledWith(
			repoRoot,
			expect.objectContaining({ latestReviewDisposition: "REJECTED", prMonitorNextAction: "REVIEW_REJECTED" }),
		);
	});

	it("wait handler notifies user when workflow is ready for manual confirmation", async () => {
		const sendUserMessage = vi.fn();
		loadMetaMock.mockResolvedValue({ prMonitorNextAction: "USER_CONFIRM" });

		const handler = createPrMonitorWaitHandler({ sendUserMessage } as never, repoRoot);
		await expect(handler()).resolves.toEqual({ nextAction: "USER_CONFIRM" });
		expect(sendUserMessage).toHaveBeenCalledWith(expect.stringContaining(PR_MONITOR_PATH), { deliverAs: "followUp" });
	});
});
