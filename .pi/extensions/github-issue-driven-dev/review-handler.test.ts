import { beforeEach, describe, expect, it, vi } from "vitest";
import { REVIEW_FILE_PATH } from "./constants.ts";
import { createReviewHandler } from "./handlers/review.ts";
import { ensureDir, readTextIfExists, writeText } from "./io.ts";
import { saveMeta } from "./meta.ts";
import { runDelegatedAgent } from "./subagent.ts";

vi.mock("./subagent.ts", () => ({
	runDelegatedAgent: vi.fn(),
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

describe("createReviewHandler", () => {
	const repoRoot = "/repo";
	const activeDir = "/repo/.pi/workflows/github-issue-driven-dev/current";
	const reviewsDir = "/repo/.pi/workflows/github-issue-driven-dev/current/reviews";
	const ensureDirMock = vi.mocked(ensureDir);
	const readTextIfExistsMock = vi.mocked(readTextIfExists);
	const writeTextMock = vi.mocked(writeText);
	const saveMetaMock = vi.mocked(saveMeta);
	const runDelegatedAgentMock = vi.mocked(runDelegatedAgent);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates a single review file on first review", async () => {
		readTextIfExistsMock.mockResolvedValue("");
		runDelegatedAgentMock.mockResolvedValue("REVIEW: ACCEPTED\n\n## Summary\n- looks good\n");

		const handler = createReviewHandler(repoRoot, activeDir, reviewsDir);
		await expect(handler()).resolves.toEqual({ reviewFile: REVIEW_FILE_PATH });

		expect(ensureDirMock).toHaveBeenCalledWith(reviewsDir);
		expect(runDelegatedAgentMock).toHaveBeenCalledWith(
			repoRoot,
			"issue-reviewer",
			expect.stringContaining(`レビュー履歴ファイル: ${REVIEW_FILE_PATH}`),
		);
		expect(writeTextMock).toHaveBeenCalledWith(
			expect.stringContaining(REVIEW_FILE_PATH),
			expect.stringContaining("# Review History\n\n## Review Round 1\n\nREVIEW: ACCEPTED"),
		);
		expect(saveMetaMock).toHaveBeenCalledWith(
			repoRoot,
			expect.objectContaining({
				latestReviewFile: REVIEW_FILE_PATH,
				latestReviewDisposition: "ACCEPTED",
			}),
		);
	});

	it("uses the last REVIEW disposition when the reviewer mentions multiple REVIEW lines", async () => {
		readTextIfExistsMock.mockResolvedValue("# Review History\n\n## Review Round 1\n\nREVIEW: ACCEPTED\n");
		runDelegatedAgentMock.mockResolvedValue("REVIEW: ACCEPTED\n\n## Critical\n- quoted old status: REVIEW: ACCEPTED\n\nREVIEW: REJECTED\n");

		const handler = createReviewHandler(repoRoot, activeDir, reviewsDir);
		await expect(handler()).rejects.toThrow(`review rejected: see ${REVIEW_FILE_PATH}`);

		expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining(REVIEW_FILE_PATH), expect.stringContaining("## Review Round 2"));
		expect(saveMetaMock).toHaveBeenCalledWith(
			repoRoot,
			expect.objectContaining({
				latestReviewFile: REVIEW_FILE_PATH,
				latestReviewDisposition: "REJECTED",
			}),
		);
	});
});
