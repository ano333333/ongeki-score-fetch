import { runCommandStreaming } from "../command.ts";
import { FORMATTER_LOG_PATH, LINTER_LOG_PATH, TEST_LOG_PATH } from "../constants.ts";
import { writeText } from "../io.ts";
import { saveMeta } from "../meta.ts";
import { repoPath } from "../paths.ts";
import { loadProjectConfig } from "../project-config.ts";
import type { CommandResult, WorkflowFunctionContext } from "../types.ts";
import { WorkflowErrorTransition } from "../workflow-transition.ts";

type VerificationTarget = {
	label: string;
	cwd: string;
	command: string;
};

async function runTarget(
	repoRoot: string,
	target: VerificationTarget,
	context?: WorkflowFunctionContext,
): Promise<CommandResult & { label: string; cwd: string; command: string }> {
	const cwd = repoPath(repoRoot, target.cwd);
	const result = await runCommandStreaming(target.command, cwd, {
		onStdout: (chunk) => {
			for (const line of chunk.split(/\r?\n/)) {
				if (!line.trim()) continue;
				context?.reportProgress?.(`[${target.label}] ${line}`);
			}
		},
		onStderr: (chunk) => {
			for (const line of chunk.split(/\r?\n/)) {
				if (!line.trim()) continue;
				context?.reportProgress?.(`[${target.label}] ${line}`, "error");
			}
		},
	});
	return { ...result, label: target.label, cwd, command: target.command };
}

async function runTargetsAndLog(
	repoRoot: string,
	logPath: string,
	name: string,
	targets: readonly VerificationTarget[],
	context?: WorkflowFunctionContext,
): Promise<CommandResult> {
	const results: Array<CommandResult & { label: string; cwd: string; command: string }> = [];
	let exitCode = 0;
	let stdout = "";
	let stderr = "";

	for (const target of targets) {
		context?.reportProgress?.(`Running ${name} for ${target.label}...`);
		const result = await runTarget(repoRoot, target, context);
		results.push(result);
		stdout += result.stdout;
		stderr += result.stderr;
		if (result.exitCode !== 0) {
			exitCode = result.exitCode;
			break;
		}
	}

	const content = [
		`# ${name}`,
		"",
		`- exitCode: ${exitCode}`,
		"",
		...results.flatMap((result) => [
			`## ${result.label}`,
			"",
			`- command: ${result.command}`,
			`- cwd: ${result.cwd}`,
			`- exitCode: ${result.exitCode}`,
			"",
			"### stdout",
			"```text",
			result.stdout.trimEnd(),
			"```",
			"",
			"### stderr",
			"```text",
			result.stderr.trimEnd(),
			"```",
			"",
		]),
	].join("\n");
	await writeText(logPath, content);
	return { exitCode, stdout, stderr };
}

export function createFormatterHandler(repoRoot: string) {
	return async (_input: unknown, context?: WorkflowFunctionContext) => {
		const config = await loadProjectConfig(repoRoot);
		const result = await runTargetsAndLog(repoRoot, repoPath(repoRoot, FORMATTER_LOG_PATH), "formatter", config.formatterTargets, context);
		await saveMeta(repoRoot, { formatterExitCode: result.exitCode, formatterRanAt: new Date().toISOString() });
		if (result.exitCode !== 0) throw new Error(`formatter failed: see ${FORMATTER_LOG_PATH}`);
		return { logPath: FORMATTER_LOG_PATH };
	};
}

export function createLinterHandler(repoRoot: string) {
	return async (_input: unknown, context?: WorkflowFunctionContext) => {
		const config = await loadProjectConfig(repoRoot);
		const result = await runTargetsAndLog(repoRoot, repoPath(repoRoot, LINTER_LOG_PATH), "linter", config.linterTargets, context);
		await saveMeta(repoRoot, { linterExitCode: result.exitCode, linterRanAt: new Date().toISOString() });
		if (result.exitCode !== 0) throw new WorkflowErrorTransition(`linter failed: see ${LINTER_LOG_PATH}`);
		return { logPath: LINTER_LOG_PATH };
	};
}

export function createTestHandler(repoRoot: string) {
	return async (_input: unknown, context?: WorkflowFunctionContext) => {
		const config = await loadProjectConfig(repoRoot);
		const result = await runTargetsAndLog(repoRoot, repoPath(repoRoot, TEST_LOG_PATH), "test", config.testTargets, context);
		await saveMeta(repoRoot, { testExitCode: result.exitCode, testRanAt: new Date().toISOString() });
		if (result.exitCode !== 0) throw new WorkflowErrorTransition(`test failed: see ${TEST_LOG_PATH}`);
		return { logPath: TEST_LOG_PATH };
	};
}
