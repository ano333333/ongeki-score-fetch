import { spawn } from "node:child_process";
import { discoverAgents } from "../subagent/agents.ts";
import { WORKFLOW_ROOT } from "./constants.ts";
import { getPiInvocation } from "./command.ts";
import { writeText } from "./io.ts";
import type { AgentConfig } from "./types.ts";

async function loadAgent(repoRoot: string, agentName: string): Promise<AgentConfig> {
	const discovery = discoverAgents(repoRoot, "project");
	const agent = discovery.agents.find((candidate) => candidate.name === agentName);
	if (!agent) {
		throw new Error(`Project agent not found: ${agentName}. Expected it under .pi/agents.`);
	}
	return agent;
}

export async function runDelegatedAgent(repoRoot: string, agentName: string, task: string): Promise<string> {
	const agent = await loadAgent(repoRoot, agentName);
	const promptPath = `${repoRoot}/${WORKFLOW_ROOT}/${agentName}.system-prompt.md`;
	await writeText(promptPath, agent.systemPrompt);

	const args = ["--mode", "json", "-p", "--no-session"];
	if (agent.model) args.push("--model", agent.model);
	if (agent.tools && agent.tools.length > 0) args.push("--tools", agent.tools.join(","));
	args.push("--append-system-prompt", promptPath, `依頼:\n${task}`);

	const invocation = getPiInvocation(args);
	const proc = spawn(invocation.command, invocation.args, {
		cwd: repoRoot,
		stdio: ["ignore", "pipe", "pipe"],
		shell: false,
	});

	let stdout = "";
	let stderr = "";
	proc.stdout.on("data", (data) => {
		stdout += data.toString();
	});
	proc.stderr.on("data", (data) => {
		stderr += data.toString();
	});

	const exitCode = await new Promise<number>((resolve) => {
		proc.on("close", (code) => resolve(code ?? 0));
		proc.on("error", () => resolve(1));
	});

	let finalText = "";
	for (const line of stdout.split(/\r?\n/)) {
		if (!line.trim()) continue;
		try {
			const event = JSON.parse(line) as {
				type?: string;
				message?: {
					role?: string;
					content?: Array<{ type: string; text?: string }>;
				};
			};
			if (event.type === "message_end" && event.message?.role === "assistant") {
				const text = event.message.content?.find((part) => part.type === "text")?.text;
				if (text) finalText = text;
			}
		} catch {
			// ignore non-JSON lines
		}
	}

	if (exitCode !== 0) {
		throw new Error(stderr || finalText || `${agentName} failed with exit code ${exitCode}`);
	}
	if (!finalText.trim()) {
		throw new Error(`${agentName} returned no final text output.`);
	}
	return finalText;
}
