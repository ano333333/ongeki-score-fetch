import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

export type ClientWorkflowAction =
	| {
			kind: "function";
			handler: string;
			input?: unknown;
	  }
	| {
			kind: "userMessage";
			content: string;
			resultKey?: string;
	  }
	| {
			kind: "continueSession";
	  };

export type WorkflowTransition = {
	id: string;
	to: string;
	trigger: "success" | "error" | "always" | "manual" | "manualOrAgent";
	label?: string;
};

export type ClientWorkflowDefinition = {
	id: string;
	initialStateId: string;
	title?: string;
	states: Record<
		string,
		{
			id: string;
			title?: string;
			action: ClientWorkflowAction;
			transitions: WorkflowTransition[];
		}
	>;
};

export type WorkflowSessionSnapshot = {
	entries: unknown[];
	leafId: string | null;
	sessionFile?: string;
};

export type WorkflowFunctionContext = {
	run: unknown;
	session: WorkflowSessionSnapshot;
	reportProgress?: (message: string, level?: "info" | "error") => void;
};

export type RegisterFunctionHandlerPayload = {
	name: string;
	handler: (input: unknown, context: WorkflowFunctionContext) => Promise<unknown> | unknown;
};

export type StartWorkflowPayload = {
	workflowId: string;
	autoRun?: boolean;
	ctx: ExtensionCommandContext;
};

export type GhIssue = {
	number: number;
	title: string;
	body?: string;
	url: string;
	labels: Array<{ name: string }>;
	assignees: Array<{ login: string }>;
	updatedAt?: string;
};

export type SelectedIssue = {
	repo: string;
	issue: GhIssue;
	priorityLabel: string;
	dependencies: Array<{ repo: string; number: number; state: string }>;
};

export type SelectionRequestInfo = {
	raw: string;
	explicitIssueNumber: number | null;
	hasExplicitIssueNumber: boolean;
	overridesDefaultCriteria: boolean;
};

export type CommandResult = {
	exitCode: number;
	stdout: string;
	stderr: string;
	signal?: NodeJS.Signals | null;
};

export type AgentConfig = {
	name: string;
	description: string;
	tools?: string[];
	model?: string;
	systemPrompt: string;
};
