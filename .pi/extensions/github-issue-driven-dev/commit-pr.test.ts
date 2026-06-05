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

	it("pushes the current branch when metadata already has an open PR URL", async () => {
		loadMetaMock.mockResolvedValue({ prUrl: "https://github.com/owner/repo/pull/123" });
		runGhJsonMock.mockResolvedValueOnce({ url: "https://github.com/owner/repo/pull/123", state: "OPEN", mergedAt: null });
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

	it("does not reuse a closed PR URL from metadata and creates a new PR when no open PR exists", async () => {
		loadMetaMock.mockResolvedValue({ prUrl: "https://github.com/owner/repo/pull/123" });
		runGhJsonMock
			.mockResolvedValueOnce({ url: "https://github.com/owner/repo/pull/123", state: "CLOSED", mergedAt: null })
			.mockResolvedValueOnce([]);
		runCommandMock.mockResolvedValueOnce({ exitCode: 0, stdout: "feature/new\n", stderr: "" });
		runDelegatedAgentMock.mockResolvedValue("PR_URL: https://github.com/owner/repo/pull/124\n");

		const handler = createPrHandler(repoRoot, activeDir);
		await expect(handler()).resolves.toEqual({
			prPath: ".pi/workflows/github-issue-driven-dev/current/PR.md",
			prUrl: "https://github.com/owner/repo/pull/124",
		});
		expect(runGhJsonMock).toHaveBeenNthCalledWith(
			2,
			["pr", "list", "--head", "feature/new", "--state", "open", "--json", "url", "--limit", "1"],
			repoRoot,
		);
		expect(runDelegatedAgentMock).toHaveBeenCalled();
	});

	it("pushes the current branch when gh detects an existing open PR", async () => {
		loadMetaMock.mockResolvedValue({});
		runCommandMock.mockResolvedValueOnce({ exitCode: 0, stdout: "feature/existing\n", stderr: "" });
		runGhJsonMock.mockResolvedValueOnce([{ url: "https://github.com/owner/repo/pull/123" }]);
		runCommandMock.mockResolvedValueOnce({ exitCode: 0, stdout: "feature/existing\n", stderr: "" });
		runCommandMock.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

		const handler = createPrHandler(repoRoot, activeDir);
		await expect(handler()).resolves.toEqual({
			prPath: ".pi/workflows/github-issue-driven-dev/current/PR.md",
			prUrl: "https://github.com/owner/repo/pull/123",
			skipped: true,
			pushedBranch: "feature/existing",
		});
		expect(runGhJsonMock).toHaveBeenCalledWith(
			["pr", "list", "--head", "feature/existing", "--state", "open", "--json", "url", "--limit", "1"],
			repoRoot,
		);
		expect(runCommandMock).toHaveBeenNthCalledWith(2, "git branch --show-current", repoRoot);
		expect(runCommandMock).toHaveBeenNthCalledWith(3, "git push", repoRoot);
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
			.mockResolvedValueOnce([{ name: "build", bucket: "pending", state: "IN_PROGRESS" }])
			.mockResolvedValueOnce({ login: "ano333333" });

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

	it("replies to new CodeRabbit comments after checks complete and moves to user confirm", async () => {
		loadMetaMock.mockResolvedValue({
			prUrl: "https://github.com/owner/repo/pull/123",
			prPendingCommentFingerprint: "[]",
		});
		readTextIfExistsMock.mockResolvedValue("# Review History\n\n## Review Round 1\n\nREVIEW: ACCEPTED\n\n## Summary\n- fixed\n");
		runGhJsonMock
			.mockResolvedValueOnce({
				url: "https://github.com/owner/repo/pull/123",
				state: "OPEN",
				updatedAt: "2026-06-04T18:10:00Z",
				comments: [
					{
						author: { login: "coderabbitai" },
						body: "please explain the fix",
						updatedAt: "2026-06-04T18:09:00Z",
						url: "https://github.com/comment/1",
					},
				],
				reviews: [],
			})
			.mockResolvedValueOnce([{ name: "build", bucket: "pass", state: "SUCCESS" }])
			.mockResolvedValueOnce({ login: "ano333333" });
		runCommandMock.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

		const handler = createPrMonitorHandler(repoRoot, activeDir);
		await expect(handler()).resolves.toEqual({
			prMonitorPath: PR_MONITOR_PATH,
			disposition: "OK",
			nextAction: "USER_CONFIRM",
			prUrl: "https://github.com/owner/repo/pull/123",
		});
		expect(runCommandMock).toHaveBeenCalledWith(
			expect.stringContaining('gh "pr" "comment" "https://github.com/owner/repo/pull/123" "--body-file" "$tmp_file"'),
			repoRoot,
		);
		expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining(PR_MONITOR_PATH), expect.stringContaining("返信しました"));
	});

	it("appends a rejected review when non-bot review feedback changed after workflow completion", async () => {
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
				comments: [],
				reviews: [{ author: { login: "reviewer" }, body: "please fix this", state: "COMMENTED", updatedAt: "2026-06-04T18:09:00Z" }],
			})
			.mockResolvedValueOnce([{ name: "build", bucket: "pass", state: "SUCCESS" }])
			.mockResolvedValueOnce({ login: "ano333333" });

		const handler = createPrMonitorHandler(repoRoot, activeDir);
		await expect(handler()).rejects.toThrow(`pr monitor detected new review comments: see ${REVIEW_FILE_PATH}`);
		expect(ensureDirMock).toHaveBeenCalled();
		expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining(REVIEW_FILE_PATH), expect.stringContaining("REVIEW: REJECTED"));
		expect(saveMetaMock).toHaveBeenCalledWith(
			repoRoot,
			expect.objectContaining({ latestReviewDisposition: "REJECTED", prMonitorNextAction: "REVIEW_REJECTED" }),
		);
	});

	it("wait handler notifies user when PR is merged", async () => {
		const sendUserMessage = vi.fn();
		loadMetaMock.mockResolvedValue({ prMonitorNextAction: "COMPLETED" });

		const handler = createPrMonitorWaitHandler({ sendUserMessage } as never, repoRoot);
		await expect(handler()).resolves.toEqual({ nextAction: "COMPLETED" });
		expect(sendUserMessage).toHaveBeenCalledWith(expect.stringContaining(PR_MONITOR_PATH), { deliverAs: "followUp" });
	});

	it("wait handler resolves on user confirm without sending an extra follow-up", async () => {
		const sendUserMessage = vi.fn();
		loadMetaMock.mockResolvedValue({ prMonitorNextAction: "USER_CONFIRM" });

		const handler = createPrMonitorWaitHandler({ sendUserMessage } as never, repoRoot);
		await expect(handler()).resolves.toEqual({ nextAction: "USER_CONFIRM" });
		expect(sendUserMessage).not.toHaveBeenCalled();
	});
});
