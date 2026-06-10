import { beforeEach, describe, expect, it, vi } from "vitest";
import { runCommand, runGhJson } from "./command.ts";
import { PR_MONITOR_PATH, REVIEW_FILE_PATH } from "./constants.ts";
import { createCommitHandler } from "./handlers/commit.ts";
import { createPrHandler } from "./handlers/create-pr.ts";
import { createPrMonitorHandler, createPrMonitorWaitHandler } from "./handlers/monitor-pr.ts";
import { ensureDir, readTextIfExists, writeText } from "./io.ts";
import { loadMeta, saveMeta } from "./meta.ts";
import { runDelegatedAgent } from "./subagent.ts";
import { summarizeWorkingTreeStatus } from "./working-tree.ts";

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
}));

vi.mock("./working-tree.ts", () => ({
	summarizeWorkingTreeStatus: vi.fn(),
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
	const summarizeWorkingTreeStatusMock = vi.mocked(summarizeWorkingTreeStatus);

	beforeEach(() => {
		vi.resetAllMocks();
		summarizeWorkingTreeStatusMock.mockResolvedValue("## Working tree\n- clean\n");
	});

	it("passes working tree hygiene guidance to the commit agent", async () => {
		runDelegatedAgentMock.mockResolvedValue("COMMITS:\n- abc123 test commit\n");

		const handler = createCommitHandler(repoRoot, activeDir);
		await expect(handler()).resolves.toEqual({ commitsPath: ".pi/workflows/github-issue-driven-dev/current/COMMITS.md" });
		expect(summarizeWorkingTreeStatusMock).toHaveBeenCalledWith(repoRoot);
		expect(runDelegatedAgentMock).toHaveBeenCalledWith(
			repoRoot,
			"issue-committer",
			expect.stringContaining("不要ファイルや生成物を盲目的に commit せず"),
		);
		expect(runDelegatedAgentMock).toHaveBeenCalledWith(repoRoot, "issue-committer", expect.stringContaining("## Working tree"));
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
				prWorkflowCompletedAt: null,
			}),
		);
	});

	it("does not reuse a closed PR URL from metadata, clears prUrl, and creates a new PR when no open PR exists", async () => {
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
		expect(saveMetaMock).toHaveBeenCalledWith(
			repoRoot,
			expect.objectContaining({
				prUrl: null,
			}),
		);
		expect(runGhJsonMock).toHaveBeenNthCalledWith(
			2,
			["pr", "list", "--head", "feature/new", "--state", "open", "--json", "url", "--limit", "1"],
			repoRoot,
		);
		expect(runDelegatedAgentMock).toHaveBeenCalled();
		expect(saveMetaMock).toHaveBeenLastCalledWith(
			repoRoot,
			expect.objectContaining({
				prUrl: "https://github.com/owner/repo/pull/124",
				prWorkflowCompletedAt: null,
			}),
		);
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
		expect(saveMetaMock).toHaveBeenCalledWith(
			repoRoot,
			expect.objectContaining({
				prUrl: "https://github.com/owner/repo/pull/123",
				prWorkflowCompletedAt: null,
			}),
		);
	});

	it("stores pending monitor output and asks the wait state to retry", async () => {
		loadMetaMock.mockResolvedValue({ prUrl: "https://github.com/owner/repo/pull/123" });
		runGhJsonMock
			.mockResolvedValueOnce({
				url: "https://github.com/owner/repo/pull/123",
				state: "OPEN",
				updatedAt: "2026-06-04T18:00:00Z",
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
		expect(runGhJsonMock).toHaveBeenCalledTimes(2);
	});

	it("waits when a newly pushed PR has not exposed checks yet", async () => {
		loadMetaMock.mockResolvedValue({
			prUrl: "https://github.com/owner/repo/pull/123",
			prPushedAt: "2026-06-05T05:16:15.533Z",
			prWorkflowCompletedAt: "2026-06-05T04:13:20.122Z",
		});
		runGhJsonMock
			.mockResolvedValueOnce({
				url: "https://github.com/owner/repo/pull/123",
				state: "OPEN",
				updatedAt: "2026-06-05T05:16:20Z",
			})
			.mockResolvedValueOnce([]);

		const handler = createPrMonitorHandler(repoRoot, activeDir);
		await expect(handler()).resolves.toEqual({
			prMonitorPath: PR_MONITOR_PATH,
			disposition: "PENDING",
			nextAction: "WAIT",
			prUrl: "https://github.com/owner/repo/pull/123",
		});
		expect(writeTextMock).toHaveBeenCalledWith(
			expect.stringContaining(PR_MONITOR_PATH),
			expect.stringContaining("最新の PR 更新に対する check がまだ観測されていない"),
		);
		expect(runGhJsonMock).toHaveBeenCalledTimes(2);
	});

	it("replies to new CodeRabbit comments after checks complete and moves to user confirm", async () => {
		loadMetaMock.mockResolvedValue({
			prUrl: "https://github.com/owner/repo/pull/123",
			prPendingCommentFingerprint: "[]",
		});
		readTextIfExistsMock.mockResolvedValue("# Review History\n\n## Review Round 1\n\nREVIEW: ACCEPTED\n\n## Summary\n- fixed\n");
		runDelegatedAgentMock.mockResolvedValue("PR_MONITOR_DECISION: USER_CONFIRM\nCOMMENT_REPLY_NEEDED: yes\nNOTE: 返信のみで十分です。");
		runGhJsonMock
			.mockResolvedValueOnce({
				url: "https://github.com/owner/repo/pull/123",
				state: "OPEN",
				updatedAt: "2026-06-04T18:10:00Z",
			})
			.mockResolvedValueOnce([{ name: "build", bucket: "pass", state: "SUCCESS" }])
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
		expect(saveMetaMock).toHaveBeenCalledWith(
			repoRoot,
			expect.objectContaining({
				prMonitorNextAction: "USER_CONFIRM",
				prPendingCommentFingerprint: expect.stringContaining("please explain the fix"),
			}),
		);
	});

	it("appends a rejected review when non-bot review feedback changed after workflow completion", async () => {
		loadMetaMock.mockResolvedValue({
			prUrl: "https://github.com/owner/repo/pull/123",
			prPendingCommentFingerprint: "[]",
		});
		readTextIfExistsMock.mockResolvedValue("# Review History\n\n## Review Round 1\n\nREVIEW: ACCEPTED\n");
		runDelegatedAgentMock.mockResolvedValue(
			"PR_MONITOR_DECISION: REVIEW_REJECTED\nCOMMENT_REPLY_NEEDED: no\nNOTE: 新しい review 指摘があり再実装が必要です。",
		);
		runGhJsonMock
			.mockResolvedValueOnce({
				url: "https://github.com/owner/repo/pull/123",
				state: "OPEN",
				updatedAt: "2026-06-04T18:10:00Z",
			})
			.mockResolvedValueOnce([{ name: "build", bucket: "pass", state: "SUCCESS" }])
			.mockResolvedValueOnce({
				url: "https://github.com/owner/repo/pull/123",
				state: "OPEN",
				updatedAt: "2026-06-04T18:10:00Z",
				comments: [],
				reviews: [{ author: { login: "reviewer" }, body: "please fix this", state: "COMMENTED", updatedAt: "2026-06-04T18:09:00Z" }],
			})
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

	it("clears prUrl and rejects when monitor detects a closed unmerged PR", async () => {
		loadMetaMock.mockResolvedValue({ prUrl: "https://github.com/owner/repo/pull/123" });
		runGhJsonMock
			.mockResolvedValueOnce({
				url: "https://github.com/owner/repo/pull/123",
				state: "CLOSED",
				mergedAt: null,
				updatedAt: "2026-06-04T19:01:11Z",
				comments: [],
				reviews: [],
			})
			.mockResolvedValueOnce([{ name: "build", bucket: "pass", state: "SUCCESS" }])
			.mockResolvedValueOnce({ login: "ano333333" });

		const handler = createPrMonitorHandler(repoRoot, activeDir);
		await expect(handler()).rejects.toThrow("pr monitor detected closed unmerged PR; open PR required");
		expect(writeTextMock).toHaveBeenCalledWith(
			expect.stringContaining(PR_MONITOR_PATH),
			expect.stringContaining("open PR は存在しないものとして扱います"),
		);
		expect(saveMetaMock).toHaveBeenCalledWith(
			repoRoot,
			expect.objectContaining({
				prUrl: null,
				prMonitorDisposition: "ACTION_REQUIRED",
				prMonitorNextAction: "REVIEW_REJECTED",
			}),
		);
	});

	it("clears prUrl and completes when monitor detects a merged PR", async () => {
		loadMetaMock.mockResolvedValue({ prUrl: "https://github.com/owner/repo/pull/123" });
		runGhJsonMock
			.mockResolvedValueOnce({
				url: "https://github.com/owner/repo/pull/123",
				state: "MERGED",
				mergedAt: "2026-06-04T19:01:11Z",
				updatedAt: "2026-06-04T19:01:11Z",
				comments: [],
				reviews: [],
			})
			.mockResolvedValueOnce([{ name: "build", bucket: "pass", state: "SUCCESS" }])
			.mockResolvedValueOnce({ login: "ano333333" });

		const handler = createPrMonitorHandler(repoRoot, activeDir);
		await expect(handler()).resolves.toEqual({
			prMonitorPath: PR_MONITOR_PATH,
			disposition: "COMPLETED",
			nextAction: "COMPLETED",
			prUrl: "https://github.com/owner/repo/pull/123",
		});
		expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining(PR_MONITOR_PATH), expect.stringContaining("PR_MONITOR: COMPLETED"));
		expect(saveMetaMock).toHaveBeenCalledWith(
			repoRoot,
			expect.objectContaining({
				prUrl: null,
				prMonitorDisposition: "COMPLETED",
				prMonitorNextAction: "COMPLETED",
			}),
		);
	});

	it("stores the current fingerprint when checks complete without additional replies", async () => {
		loadMetaMock.mockResolvedValue({
			prUrl: "https://github.com/owner/repo/pull/123",
			prPendingCommentFingerprint: "[]",
		});
		runGhJsonMock
			.mockResolvedValueOnce({
				url: "https://github.com/owner/repo/pull/123",
				state: "OPEN",
				updatedAt: "2026-06-04T18:10:00Z",
			})
			.mockResolvedValueOnce([{ name: "build", bucket: "pass", state: "SUCCESS" }])
			.mockResolvedValueOnce({
				url: "https://github.com/owner/repo/pull/123",
				state: "OPEN",
				updatedAt: "2026-06-04T18:10:00Z",
				comments: [],
				reviews: [],
			})
			.mockResolvedValueOnce({ login: "ano333333" });

		const handler = createPrMonitorHandler(repoRoot, activeDir);
		await expect(handler()).resolves.toEqual({
			prMonitorPath: PR_MONITOR_PATH,
			disposition: "OK",
			nextAction: "USER_CONFIRM",
			prUrl: "https://github.com/owner/repo/pull/123",
		});
		expect(saveMetaMock).toHaveBeenCalledWith(
			repoRoot,
			expect.objectContaining({
				prMonitorNextAction: "USER_CONFIRM",
				prPendingCommentFingerprint: "[]",
			}),
		);
	});

	it("uses delegated natural-language judgement to ignore non-actionable comment changes", async () => {
		loadMetaMock.mockResolvedValue({
			prUrl: "https://github.com/owner/repo/pull/123",
			prPendingCommentFingerprint: "[]",
		});
		readTextIfExistsMock.mockResolvedValue("# Review History\n\n## Review Round 1\n\nREVIEW: ACCEPTED\n");
		runDelegatedAgentMock.mockResolvedValue(
			"PR_MONITOR_DECISION: USER_CONFIRM\nCOMMENT_REPLY_NEEDED: no\nNOTE: 情報共有のみで追加実装は不要です。",
		);
		runGhJsonMock
			.mockResolvedValueOnce({
				url: "https://github.com/owner/repo/pull/123",
				state: "OPEN",
				updatedAt: "2026-06-04T18:10:00Z",
			})
			.mockResolvedValueOnce([{ name: "build", bucket: "pass", state: "SUCCESS" }])
			.mockResolvedValueOnce({
				url: "https://github.com/owner/repo/pull/123",
				state: "OPEN",
				updatedAt: "2026-06-04T18:10:00Z",
				comments: [
					{
						author: { login: "teammate" },
						body: "looks good to me",
						updatedAt: "2026-06-04T18:09:00Z",
						url: "https://github.com/comment/2",
					},
				],
				reviews: [],
			})
			.mockResolvedValueOnce({ login: "ano333333" });

		const handler = createPrMonitorHandler(repoRoot, activeDir);
		await expect(handler()).resolves.toEqual({
			prMonitorPath: PR_MONITOR_PATH,
			disposition: "OK",
			nextAction: "USER_CONFIRM",
			prUrl: "https://github.com/owner/repo/pull/123",
		});
		expect(runDelegatedAgentMock).toHaveBeenCalledWith(
			repoRoot,
			"issue-pr-monitor",
			expect.stringContaining("今回新たに観測した PR feedback"),
		);
		expect(runCommandMock).not.toHaveBeenCalled();
	});

	it("wait handler notifies user when PR is merged", async () => {
		const sendUserMessage = vi.fn();
		loadMetaMock.mockResolvedValue({ prMonitorNextAction: "COMPLETED" });

		const handler = createPrMonitorWaitHandler({ sendUserMessage } as never, repoRoot);
		await expect(handler()).resolves.toEqual({ nextAction: "COMPLETED" });
		expect(sendUserMessage).toHaveBeenCalledWith(expect.stringContaining(PR_MONITOR_PATH), { deliverAs: "followUp" });
	});

	it("wait handler resolves on user confirm only when an open PR is still tracked", async () => {
		const sendUserMessage = vi.fn();
		loadMetaMock.mockResolvedValue({ prMonitorNextAction: "USER_CONFIRM", prUrl: "https://github.com/owner/repo/pull/123" });

		const handler = createPrMonitorWaitHandler({ sendUserMessage } as never, repoRoot);
		await expect(handler()).resolves.toEqual({ nextAction: "USER_CONFIRM" });
		expect(sendUserMessage).not.toHaveBeenCalled();
	});

	it("wait handler rejects stale user confirm when no open PR is tracked", async () => {
		const sendUserMessage = vi.fn();
		loadMetaMock.mockResolvedValue({ prMonitorNextAction: "USER_CONFIRM", prUrl: null });

		const handler = createPrMonitorWaitHandler({ sendUserMessage } as never, repoRoot);
		await expect(handler()).rejects.toThrow("pr monitor user confirm requires an open PR");
		expect(sendUserMessage).not.toHaveBeenCalled();
	});

	it("wait handler passes through non-confirm actions that should already be handled by earlier workflow transitions", async () => {
		const sendUserMessage = vi.fn();
		loadMetaMock.mockResolvedValue({ prMonitorNextAction: "REVIEW_REJECTED", prUrl: null });

		const handler = createPrMonitorWaitHandler({ sendUserMessage } as never, repoRoot);
		await expect(handler()).resolves.toEqual({ nextAction: "REVIEW_REJECTED" });
		expect(sendUserMessage).not.toHaveBeenCalled();
	});
});
