import { beforeEach, describe, expect, it, vi } from "vitest";
import { PR_MONITOR_PATH } from "./constants.ts";
import { createPrMonitorHandler } from "./handlers/commit-pr.ts";
import { writeText } from "./io.ts";
import { loadMeta, saveMeta } from "./meta.ts";
import { runDelegatedAgent } from "./subagent.ts";

vi.mock("./subagent.ts", () => ({
	runDelegatedAgent: vi.fn(),
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

describe("createPrMonitorHandler", () => {
	const repoRoot = "/repo";
	const activeDir = "/repo/.pi/workflows/github-issue-driven-dev/current";
	const loadMetaMock = vi.mocked(loadMeta);
	const saveMetaMock = vi.mocked(saveMeta);
	const writeTextMock = vi.mocked(writeText);
	const runDelegatedAgentMock = vi.mocked(runDelegatedAgent);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("stores monitor output and metadata when a PR URL is present", async () => {
		loadMetaMock.mockResolvedValue({ prUrl: "https://github.com/owner/repo/pull/123" });
		runDelegatedAgentMock.mockResolvedValue(
			"PR_MONITOR: PENDING\n\n## GitHub Actions\n- build is still running\n\n## CodeRabbit\n- review not posted yet\n",
		);

		const handler = createPrMonitorHandler(repoRoot, activeDir);
		await expect(handler()).resolves.toEqual({
			prMonitorPath: PR_MONITOR_PATH,
			disposition: "PENDING",
			prUrl: "https://github.com/owner/repo/pull/123",
		});
		expect(runDelegatedAgentMock).toHaveBeenCalledWith(
			repoRoot,
			"issue-pr-monitor",
			expect.stringContaining("Pull request URL: https://github.com/owner/repo/pull/123"),
		);
		expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining(PR_MONITOR_PATH), expect.stringContaining("PR_MONITOR: PENDING"));
		expect(saveMetaMock).toHaveBeenCalledWith(
			repoRoot,
			expect.objectContaining({
				prMonitorDisposition: "PENDING",
				prMonitorAgent: "issue-pr-monitor",
				prMonitorPath: PR_MONITOR_PATH,
			}),
		);
	});

	it("fails when metadata does not contain a PR URL", async () => {
		loadMetaMock.mockResolvedValue({});

		const handler = createPrMonitorHandler(repoRoot, activeDir);
		await expect(handler()).rejects.toThrow("PR URL not found in metadata. Create the PR before monitoring it.");
		expect(runDelegatedAgentMock).not.toHaveBeenCalled();
	});
});
