import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIG_PATH, DEFAULT_CONFIG, FORMATTER_TARGETS, LINTER_TARGETS, PR_MONITOR_WAIT_MS, TEST_TARGETS } from "./constants.ts";
import { readJson } from "./io.ts";
import { loadProjectConfig } from "./project-config.ts";

vi.mock("./io.ts", () => ({
	writeText: vi.fn(),
	ensureDir: vi.fn(),
	resetDir: vi.fn(),
	readTextIfExists: vi.fn(),
	readJson: vi.fn(),
	writeJson: vi.fn(),
}));

describe("loadProjectConfig", () => {
	const repoRoot = "/repo";
	const readJsonMock = vi.mocked(readJson);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns the default config when config.json does not exist", async () => {
		readJsonMock.mockResolvedValue(null);

		await expect(loadProjectConfig(repoRoot)).resolves.toEqual({
			...DEFAULT_CONFIG,
			formatterTargets: [...FORMATTER_TARGETS],
			linterTargets: [...LINTER_TARGETS],
			testTargets: [...TEST_TARGETS],
			prMonitorWaitMs: PR_MONITOR_WAIT_MS,
		});
		expect(readJsonMock).toHaveBeenCalledWith(`/repo/${CONFIG_PATH}`);
	});

	it("overrides only the provided fields with a shallow merge", async () => {
		readJsonMock.mockResolvedValue({
			repo: "owner/alt-repo",
			issueLimit: 25,
			reviewAgent: "custom-reviewer",
			formatterTargets: [{ label: "repo", cwd: ".", command: "pnpm format" }],
			prMonitorWaitMs: 1500,
		});

		await expect(loadProjectConfig(repoRoot)).resolves.toEqual({
			...DEFAULT_CONFIG,
			repo: "owner/alt-repo",
			issueLimit: 25,
			reviewAgent: "custom-reviewer",
			formatterTargets: [{ label: "repo", cwd: ".", command: "pnpm format" }],
			linterTargets: [...LINTER_TARGETS],
			testTargets: [...TEST_TARGETS],
			prMonitorWaitMs: 1500,
		});
	});
});
