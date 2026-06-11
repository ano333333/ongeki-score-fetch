export const REGISTER_WORKFLOW_EVENT = "state-workflow:register-workflow";
export const REGISTER_FUNCTION_HANDLER_EVENT = "state-workflow:register-function-handler";
export const START_WORKFLOW_EVENT = "state-workflow:start-workflow";

export const WORKFLOW_ID = "github-issue-driven-dev";
export const WORKFLOW_ROOT = ".pi/workflows/github-issue-driven-dev";
export const ACTIVE_RUN_DIR = `${WORKFLOW_ROOT}/current`;
export const ISSUE_PATH = `${ACTIVE_RUN_DIR}/ISSUE.md`;
export const PLAN_PATH = `${ACTIVE_RUN_DIR}/PLAN.md`;
export const SELECTION_PATH = `${ACTIVE_RUN_DIR}/SELECTION.md`;
export const FORMATTER_LOG_PATH = `${ACTIVE_RUN_DIR}/formatter.log`;
export const LINTER_LOG_PATH = `${ACTIVE_RUN_DIR}/linter.log`;
export const TEST_LOG_PATH = `${ACTIVE_RUN_DIR}/test.log`;
export const COMMITS_PATH = `${ACTIVE_RUN_DIR}/COMMITS.md`;
export const PR_PATH = `${ACTIVE_RUN_DIR}/PR.md`;
export const PR_MONITOR_PATH = `${ACTIVE_RUN_DIR}/PR_MONITOR.md`;
export const META_PATH = `${ACTIVE_RUN_DIR}/meta.json`;
export const PR_MONITOR_WAIT_MS = 3 * 60 * 1000;
export const REVIEWS_DIR = `${ACTIVE_RUN_DIR}/reviews`;
export const REVIEW_FILE_PATH = `${REVIEWS_DIR}/review.md`;
export const ISSUE_CANDIDATES_PATH = `${ACTIVE_RUN_DIR}/ISSUES.md`;
export const SELECTION_REQUEST_PATH = `${ACTIVE_RUN_DIR}/REQUEST.md`;
export const PENDING_SELECTION_REQUEST_PATH = `${WORKFLOW_ROOT}/start-request.txt`;
export const CONFIG_PATH = `${WORKFLOW_ROOT}/config.json`;

export const DEFAULT_CONFIG = {
	repo: undefined as string | undefined,
	priorityOrder: ["priority-high", "priority-middle", "priority-low"],
	issueLimit: 100,
	reviewAgent: "issue-reviewer",
	commitAgent: "issue-committer",
	prAgent: "issue-pr-author",
	prMonitorAgent: "issue-pr-monitor",
};

export const FORMATTER_TARGETS = [
	{ label: "chrome-extension", cwd: "chrome-extension", command: "CI=true pnpm format" },
	{ label: "gcp", cwd: "gcp", command: "terraform fmt -recursive . && biome format --write biome.json .prettierrc" },
	{ label: ".pi/extensions", cwd: ".pi/extensions", command: "CI=true pnpm format" },
] as const;

export const LINTER_TARGETS = [
	{ label: "chrome-extension", cwd: "chrome-extension", command: "CI=true pnpm lint" },
	{ label: "gcp", cwd: "gcp", command: "tflint --init && tflint --recursive && biome lint biome.json" },
	{ label: ".pi/extensions", cwd: ".pi/extensions", command: "CI=true pnpm lint" },
] as const;

export const TEST_TARGETS = [{ label: ".pi/extensions", cwd: ".pi/extensions", command: "CI=true pnpm test" }] as const;
