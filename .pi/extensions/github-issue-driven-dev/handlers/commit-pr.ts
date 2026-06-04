import { COMMITS_PATH, DEFAULT_CONFIG, ISSUE_PATH, PLAN_PATH, PR_MONITOR_PATH, PR_PATH, REVIEW_FILE_PATH } from "../constants.ts";
import { loadMeta } from "../meta.ts";
import { writeText } from "../io.ts";
import { saveMeta } from "../meta.ts";
import { repoPath } from "../paths.ts";
import { runDelegatedAgent } from "../subagent.ts";

export function createCommitHandler(repoRoot: string, activeDir: string) {
	return async () => {
		const commitText = await runDelegatedAgent(
			repoRoot,
			DEFAULT_CONFIG.commitAgent,
			[
				"現在の workflow 変更を、意味のある単位の git commit にまとめてください。",
				`Repository root: ${repoRoot}`,
				`Workflow directory: ${activeDir}`,
				`必ず ${ISSUE_PATH}、${PLAN_PATH}、${REVIEW_FILE_PATH} を文脈として読んでください。`,
				"実際に git commit を作成してください。",
				"完了後は 'COMMITS:' という見出しを含め、各 commit を short SHA と subject 付きの箇条書きで出力してください。",
			].join("\n\n"),
		);
		await writeText(repoPath(repoRoot, COMMITS_PATH), `${commitText.trimEnd()}\n`);
		await saveMeta(repoRoot, { commitsRecordedAt: new Date().toISOString(), commitAgent: DEFAULT_CONFIG.commitAgent });
		return { commitsPath: COMMITS_PATH };
	};
}

export function createPrHandler(repoRoot: string, activeDir: string) {
	return async () => {
		const prText = await runDelegatedAgent(
			repoRoot,
			DEFAULT_CONFIG.prAgent,
			[
				"現在の branch について gh を使って pull request を作成してください。",
				`Repository root: ${repoRoot}`,
				`Workflow directory: ${activeDir}`,
				`必ず ${ISSUE_PATH}、${PLAN_PATH}、${COMMITS_PATH}、${REVIEW_FILE_PATH} を文脈として読んでください。`,
				"実際に gh pr create を実行してください。",
				"最終出力の 1 行目は必ず 'PR_URL: <url>' にしてください。",
			].join("\n\n"),
		);
		await writeText(repoPath(repoRoot, PR_PATH), `${prText.trimEnd()}\n`);
		const urlMatch = prText.match(/^PR_URL:\s*(https?:\/\/\S+)/im);
		await saveMeta(repoRoot, {
			prUrl: urlMatch?.[1] ?? null,
			prCreatedAt: new Date().toISOString(),
			prAgent: DEFAULT_CONFIG.prAgent,
		});
		if (!urlMatch?.[1]) throw new Error(`PR URL not found in ${PR_PATH}`);
		return { prPath: PR_PATH, prUrl: urlMatch[1] };
	};
}

export function createPrMonitorHandler(repoRoot: string, activeDir: string) {
	return async () => {
		const meta = await loadMeta(repoRoot);
		const prUrl = typeof meta.prUrl === "string" ? meta.prUrl : null;
		if (!prUrl) {
			throw new Error("PR URL not found in metadata. Create the PR before monitoring it.");
		}

		const monitorText = await runDelegatedAgent(
			repoRoot,
			DEFAULT_CONFIG.prMonitorAgent,
			[
				"既存の pull request を確認し、GitHub Actions と CodeRabbit に追加対応が必要か要約してください。",
				`Repository root: ${repoRoot}`,
				`Workflow directory: ${activeDir}`,
				`必ず ${ISSUE_PATH}、${PLAN_PATH}、${COMMITS_PATH}、${PR_PATH}、${REVIEW_FILE_PATH} を文脈として読んでください。`,
				`Pull request URL: ${prUrl}`,
				"ソースファイルの変更、commit 作成、PR の編集はしないでください。",
				"必要に応じて gh などの読み取り専用コマンドだけを使ってください。",
				"最終出力の 1 行目は必ず 'PR_MONITOR: OK'、'PR_MONITOR: PENDING'、'PR_MONITOR: ACTION_REQUIRED' のいずれか 1 つにしてください。",
			].join("\n\n"),
		);
		await writeText(repoPath(repoRoot, PR_MONITOR_PATH), `${monitorText.trimEnd()}\n`);
		const dispositionMatch = monitorText.match(/^PR_MONITOR:\s*(OK|PENDING|ACTION_REQUIRED)/im);
		await saveMeta(repoRoot, {
			prMonitorDisposition: dispositionMatch?.[1] ?? "UNKNOWN",
			prMonitorAgent: DEFAULT_CONFIG.prMonitorAgent,
			prMonitoredAt: new Date().toISOString(),
			prMonitorPath: PR_MONITOR_PATH,
		});
		if (!dispositionMatch?.[1]) throw new Error(`PR monitor disposition not found in ${PR_MONITOR_PATH}`);
		return { prMonitorPath: PR_MONITOR_PATH, disposition: dispositionMatch[1], prUrl };
	};
}
