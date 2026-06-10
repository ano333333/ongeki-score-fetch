import { ISSUE_PATH, LINTER_LOG_PATH, PLAN_PATH, PR_MONITOR_PATH, REVIEW_FILE_PATH, TEST_LOG_PATH } from "./constants.ts";

export const promptImplement = (): string =>
	[
		"GitHub issue driven dev workflow: 実装フェーズです。",
		`${ISSUE_PATH} と ${PLAN_PATH} を読んでください。`,
		"このフローは追加の skill ではなく、pi + state-workflow の state と handler を中心に進みます。",
		"選ばれた issue に必要な範囲だけ実装してください。",
		"必要に応じてファイル調査、コード編集、コマンド実行を行って構いません。",
		"実装の最後に git status を確認し、不要ファイルや意図しない生成物（不要ログ、tmp、untracked build artifact など）を残さないでください。",
		"重要な判断があれば、セッションに有用な reasoning を残してください。",
		"この実装フェーズでは、ここで行った変更を review フェーズに渡せる状態まで整えることが目的です。PR 作成や PR 監視は後続 state で行われます。",
		`レビュー通過後は PR 作成に加えて ${PR_MONITOR_PATH} へ GitHub Actions / CodeRabbit の監視結果も残る前提で進めてください。`,
		"レビューに進むには、実装が一区切りついた時点で workflow_next tool を transitionId: to-run-formatter で呼び、formatter 実行へ進んでください。",
	].join("\n");

export const promptFixLinter = (): string =>
	[
		"GitHub issue driven dev workflow: linter に失敗しました。",
		`${LINTER_LOG_PATH} の出力を読んでください。`,
		"スコープを広げずに lint エラーを修正してください。",
		"修正後は、formatter/linter/test/review を自動で流すため、workflow_next tool を transitionId: retry-formatter-after-lint で呼んで formatter に戻してください。",
	].join("\n");

export const promptFixTest = (): string =>
	[
		"GitHub issue driven dev workflow: test に失敗しました。",
		`${TEST_LOG_PATH} の出力を読んでください。`,
		"失敗しているテスト、またはその原因となっている実装バグを修正してください。",
		"修正後は、formatter/linter/test/review を自動で流すため、workflow_next tool を transitionId: retry-formatter-after-test で呼んで formatter に戻してください。",
	].join("\n");

export const promptAddressReview = (): string =>
	[
		"GitHub issue driven dev workflow: review で差し戻されました。",
		`${REVIEW_FILE_PATH} を読んでください。`,
		"そのファイルの最新の REJECTED 指摘に対応し、修正内容も同じ review ファイルに追記してください。",
		"指摘事項を修正した後、formatter/linter/test/review を自動で再実行するため、workflow_next tool を transitionId: retry-formatter-after-review で呼んで formatter に戻してください。",
	].join("\n");
