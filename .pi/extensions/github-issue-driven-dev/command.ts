import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { CommandResult } from "./types.ts";

export type RunCommandStreamingOptions = {
	onStdout?: (chunk: string) => void;
	onStderr?: (chunk: string) => void;
};

export function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
	if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}

	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) {
		return { command: process.execPath, args };
	}

	return { command: "pi", args };
}

export async function runCommandStreaming(command: string, cwd: string, options: RunCommandStreamingOptions = {}): Promise<CommandResult> {
	return await new Promise((resolve) => {
		const proc = spawn("bash", ["-lc", command], {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		proc.stdout.on("data", (data) => {
			const chunk = data.toString();
			stdout += chunk;
			options.onStdout?.(chunk);
		});
		proc.stderr.on("data", (data) => {
			const chunk = data.toString();
			stderr += chunk;
			options.onStderr?.(chunk);
		});
		proc.on("close", (code, signal) => {
			resolve({ exitCode: code ?? (signal ? 128 : 0), stdout, stderr, signal });
		});
		proc.on("error", (error) => {
			resolve({ exitCode: 1, stdout, stderr: `${stderr}${error.message}` });
		});
	});
}

export async function runCommand(command: string, cwd: string): Promise<CommandResult> {
	return await runCommandStreaming(command, cwd);
}

export async function runGhJson<T>(args: string[], cwd: string): Promise<T> {
	const quoted = args.map((arg) => JSON.stringify(arg)).join(" ");
	const result = await runCommand(`gh ${quoted}`, cwd);
	if (result.exitCode !== 0) {
		throw new Error(result.stderr || `gh command failed: gh ${args.join(" ")}`);
	}
	return JSON.parse(result.stdout) as T;
}
