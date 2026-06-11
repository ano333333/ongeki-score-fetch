import { COMMITS_PATH, ISSUE_PATH, PLAN_PATH, REVIEW_FILE_PATH } from "../constants.ts";
import { writeText } from "../io.ts";
import { saveMeta } from "../meta.ts";
import { repoPath } from "../paths.ts";
import { loadProjectConfig } from "../project-config.ts";
import { runDelegatedAgent } from "../subagent.ts";
import { summarizeWorkingTreeStatus } from "../working-tree.ts";

export function createCommitHandler(repoRoot: string, activeDir: string) {
	return async () => {
		const config = await loadProjectConfig(repoRoot);
		const workTreeSummary = await summarizeWorkingTreeStatus(repoRoot);
		const commitText = await runDelegatedAgent(
			repoRoot,
			config.commitAgent,
			[
				"現在の workflow 変更を、意味のある単位の git commit にまとめてください。",
				`Repository root: ${repoRoot}`,
				`Workflow directory: ${activeDir}`,
				`必ず ${ISSUE_PATH}、${PLAN_PATH}、${REVIEW_FILE_PATH} を文脈として読んでください。`,
				"不要ファイルや生成物を盲目的に commit せず、必要なら除外または未 commit として明記してください。",
				`現在の working tree 要約:\n\n${workTreeSummary}`,
				"実際に git commit を作成してください。",
				"完了後は 'COMMITS:' という見出しを含め、各 commit を short SHA と subject 付きの箇条書きで出力してください。",
			].join("\n\n"),
		);
		await writeText(repoPath(repoRoot, COMMITS_PATH), `${commitText.trimEnd()}\n`);
		await saveMeta(repoRoot, { commitsRecordedAt: new Date().toISOString(), commitAgent: config.commitAgent });
		return { commitsPath: COMMITS_PATH };
	};
}
