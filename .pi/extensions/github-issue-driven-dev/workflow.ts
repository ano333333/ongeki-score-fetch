import { FORMATTER_LOG_PATH, ISSUE_PATH, PLAN_PATH, PR_MONITOR_PATH, SELECTION_PATH, WORKFLOW_ID } from "./constants.ts";
import type { ClientWorkflowDefinition } from "./types.ts";

export const workflowDefinition: ClientWorkflowDefinition = {
	id: WORKFLOW_ID,
	title: "GitHub issue driven dev",
	initialStateId: "select-issue",
	states: {
		"select-issue": {
			id: "select-issue",
			title: "Select Issue",
			action: { kind: "function", handler: "githubIssueDrivenDev.selectIssue" },
			transitions: [{ id: "to-create-plan", to: "create-plan", trigger: "manual", label: "create plan" }],
		},
		"create-plan": {
			id: "create-plan",
			title: "Create Plan",
			action: {
				kind: "userMessage",
				content: [
					"GitHub issue driven dev workflow: 計画作成フェーズです。",
					`${ISSUE_PATH} と ${SELECTION_PATH} を読んでください。`,
					"SELECTION.md に書かれた選定理由を前提に計画してください。明示要求で既定基準が上書きされている場合は、その理由を優先してください。",
					`${PLAN_PATH} に新しい計画を書いてください。`,
					"まだ実装はしないでください。",
					"計画には、変更方針、影響しそうなファイル、検証方法、リスク・前提を含めてください。",
					"PLAN.md の作成が終わったら停止し、ユーザーが手動で workflow を進めるのを待ってください。",
				].join("\n"),
			},
			transitions: [{ id: "to-implement", to: "implement", trigger: "manual", label: "start implementation" }],
		},
		implement: {
			id: "implement",
			title: "Implement",
			action: {
				kind: "userMessage",
				content: [
					"GitHub issue driven dev workflow: 実装フェーズです。",
					`${ISSUE_PATH} と ${PLAN_PATH} を読んでください。`,
					"このフローは追加の skill ではなく、pi + state-workflow の state と handler を中心に進みます。",
					"選ばれた issue に必要な範囲だけ実装してください。",
					"必要に応じてファイル調査、コード編集、コマンド実行を行って構いません。",
					"重要な判断があれば、セッションに有用な reasoning を残してください。",
					`レビュー通過後は PR 作成に加えて ${PR_MONITOR_PATH} へ GitHub Actions / CodeRabbit の監視結果も残る前提で進めてください。`,
					"実装が完了したら workflow_next tool を transitionId: to-run-formatter で呼び、formatter 実行へ進んでください。",
				].join("\n"),
			},
			transitions: [{ id: "to-run-formatter", to: "run-formatter", trigger: "manualOrAgent", label: "run formatter" }],
		},
		"run-formatter": {
			id: "run-formatter",
			title: "Run Formatter",
			action: { kind: "function", handler: "githubIssueDrivenDev.runFormatter" },
			transitions: [{ id: "to-run-linter", to: "run-linter", trigger: "success" }],
		},
		"run-linter": {
			id: "run-linter",
			title: "Run Linter",
			action: { kind: "function", handler: "githubIssueDrivenDev.runLinter" },
			transitions: [
				{ id: "to-fix-linter", to: "fix-linter", trigger: "error" },
				{ id: "to-run-test", to: "run-test", trigger: "success" },
			],
		},
		"fix-linter": {
			id: "fix-linter",
			title: "Fix Linter",
			action: { kind: "function", handler: "githubIssueDrivenDev.promptFixLinter" },
			transitions: [{ id: "retry-formatter-after-lint", to: "run-formatter", trigger: "manualOrAgent", label: "rerun formatter" }],
		},
		"run-test": {
			id: "run-test",
			title: "Run Test",
			action: { kind: "function", handler: "githubIssueDrivenDev.runTest" },
			transitions: [
				{ id: "to-fix-test", to: "fix-test", trigger: "error" },
				{ id: "to-review", to: "review", trigger: "success" },
			],
		},
		"fix-test": {
			id: "fix-test",
			title: "Fix Test",
			action: { kind: "function", handler: "githubIssueDrivenDev.promptFixTest" },
			transitions: [{ id: "retry-formatter-after-test", to: "run-formatter", trigger: "manualOrAgent", label: "rerun formatter" }],
		},
		review: {
			id: "review",
			title: "Review",
			action: { kind: "function", handler: "githubIssueDrivenDev.review" },
			transitions: [
				{ id: "to-address-review", to: "address-review", trigger: "error" },
				{ id: "to-commit", to: "commit", trigger: "success" },
			],
		},
		"address-review": {
			id: "address-review",
			title: "Address Review",
			action: { kind: "function", handler: "githubIssueDrivenDev.promptAddressReview" },
			transitions: [{ id: "retry-formatter-after-review", to: "run-formatter", trigger: "manualOrAgent", label: "rerun formatter" }],
		},
		commit: {
			id: "commit",
			title: "Commit",
			action: { kind: "function", handler: "githubIssueDrivenDev.commit" },
			transitions: [{ id: "to-create-pr", to: "create-pr", trigger: "success" }],
		},
		"create-pr": {
			id: "create-pr",
			title: "Create PR",
			action: { kind: "function", handler: "githubIssueDrivenDev.createPr" },
			transitions: [{ id: "to-monitor-pr", to: "monitor-pr", trigger: "success" }],
		},
		"monitor-pr": {
			id: "monitor-pr",
			title: "PR Status Check",
			action: { kind: "function", handler: "githubIssueDrivenDev.monitorPr" },
			transitions: [
				{ id: "to-address-review-from-pr-monitor", to: "address-review", trigger: "error" },
				{ id: "to-wait-pr-monitor", to: "wait-pr-monitor", trigger: "success" },
			],
		},
		"wait-pr-monitor": {
			id: "wait-pr-monitor",
			title: "PR Status Wait",
			action: { kind: "function", handler: "githubIssueDrivenDev.waitPrMonitor" },
			transitions: [{ id: "retry-monitor-pr", to: "monitor-pr", trigger: "error" }],
		},
	},
};
