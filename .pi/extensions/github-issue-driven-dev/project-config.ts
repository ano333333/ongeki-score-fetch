import { CONFIG_PATH, DEFAULT_CONFIG, FORMATTER_TARGETS, LINTER_TARGETS, PR_MONITOR_WAIT_MS, TEST_TARGETS } from "./constants.ts";
import { readJson } from "./io.ts";
import { repoPath } from "./paths.ts";

export type ProjectCommandTarget = {
	label: string;
	cwd: string;
	command: string;
};

export type ProjectConfig = {
	repo: string | undefined;
	priorityOrder: string[];
	issueLimit: number;
	reviewAgent: string;
	commitAgent: string;
	prAgent: string;
	prMonitorAgent: string;
	formatterTargets: ProjectCommandTarget[];
	linterTargets: ProjectCommandTarget[];
	testTargets: ProjectCommandTarget[];
	prMonitorWaitMs: number;
};

const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
	...DEFAULT_CONFIG,
	formatterTargets: [...FORMATTER_TARGETS],
	linterTargets: [...LINTER_TARGETS],
	testTargets: [...TEST_TARGETS],
	prMonitorWaitMs: PR_MONITOR_WAIT_MS,
};

export async function loadProjectConfig(repoRoot: string): Promise<ProjectConfig> {
	const loaded = await readJson<Partial<ProjectConfig>>(repoPath(repoRoot, CONFIG_PATH));
	if (!loaded) return DEFAULT_PROJECT_CONFIG;
	return {
		...DEFAULT_PROJECT_CONFIG,
		...loaded,
	};
}
