import { beforeEach, describe, expect, it, vi } from "vitest";
import { ISSUE_CANDIDATES_PATH, REVIEWS_DIR, SELECTION_REQUEST_PATH, WORKFLOW_ID } from "./constants.ts";
import { createSelectIssueHandler } from "./handlers/select-issue.ts";
import { ensureDir, readTextIfExists, resetDir, writeText } from "./io.ts";
import { listOpenIssues, parseSelectionRequest } from "./issue-selection.ts";
import { saveMeta } from "./meta.ts";

vi.mock("./io.ts", () => ({
	writeText: vi.fn(),
	ensureDir: vi.fn(),
	resetDir: vi.fn(),
	readTextIfExists: vi.fn(),
	readJson: vi.fn(),
	writeJson: vi.fn(),
	listReviewFiles: vi.fn(),
}));

vi.mock("./meta.ts", () => ({
	saveMeta: vi.fn(),
	loadMeta: vi.fn(),
}));

vi.mock("./issue-selection.ts", async () => {
	const actual = await vi.importActual<typeof import("./issue-selection.ts")>("./issue-selection.ts");
	return {
		...actual,
		listOpenIssues: vi.fn(),
		parseSelectionRequest: vi.fn(),
	};
});

describe("createSelectIssueHandler", () => {
	const repoRoot = "/repo";
	const activeDir = "/repo/.pi/workflows/github-issue-driven-dev/current";
	const sendUserMessage = vi.fn();
	const pi = { sendUserMessage } as never;
	const readTextIfExistsMock = vi.mocked(readTextIfExists);
	const listOpenIssuesMock = vi.mocked(listOpenIssues);
	const parseSelectionRequestMock = vi.mocked(parseSelectionRequest);
	const saveMetaMock = vi.mocked(saveMeta);
	const writeTextMock = vi.mocked(writeText);
	const resetDirMock = vi.mocked(resetDir);
	const ensureDirMock = vi.mocked(ensureDir);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("fails early when there are no open issues", async () => {
		readTextIfExistsMock.mockResolvedValue("63,final check");
		listOpenIssuesMock.mockResolvedValue({ repo: "owner/repo", issues: [] });
		parseSelectionRequestMock.mockReturnValue({
			raw: "63,final check",
			explicitIssueNumber: 63,
			hasExplicitIssueNumber: true,
			overridesDefaultCriteria: true,
		});

		const handler = createSelectIssueHandler(pi, repoRoot, activeDir);
		await expect(handler()).rejects.toThrow("no open issues found for owner/repo");
		expect(resetDirMock).toHaveBeenCalledWith(activeDir);
		expect(ensureDirMock).toHaveBeenCalledWith("/repo/.pi/workflows/github-issue-driven-dev/current/reviews");
		expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining(SELECTION_REQUEST_PATH), expect.any(String));
		expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining(ISSUE_CANDIDATES_PATH), expect.any(String));
		expect(saveMetaMock).toHaveBeenCalledWith(
			repoRoot,
			expect.objectContaining({ workflowId: WORKFLOW_ID, repo: "owner/repo", issueNumber: null }),
		);
		expect(sendUserMessage).not.toHaveBeenCalled();
	});
});
