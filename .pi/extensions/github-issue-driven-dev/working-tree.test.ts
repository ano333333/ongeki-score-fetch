import { describe, expect, it } from "vitest";
import { isSuspiciousWorkingTreeEntry, parseGitStatusShort, summarizeWorkingTreeEntries } from "./working-tree.ts";

describe("working tree helpers", () => {
	it("parses git status --short output including renames", () => {
		expect(parseGitStatusShort("M  src/index.ts\nR  old.ts -> new.ts\n?? tmp/debug.log\n")).toEqual([
			{ indexStatus: "M", workTreeStatus: " ", code: "M ", path: "src/index.ts", originalPath: undefined },
			{ indexStatus: "R", workTreeStatus: " ", code: "R ", path: "new.ts", originalPath: "old.ts" },
			{ indexStatus: "?", workTreeStatus: "?", code: "??", path: "tmp/debug.log", originalPath: undefined },
		]);
	});

	it("flags suspicious generated or temporary files while allowing workflow logs", () => {
		expect(isSuspiciousWorkingTreeEntry(parseGitStatusShort("?? tmp/debug.log\n")[0])).toBe(true);
		expect(isSuspiciousWorkingTreeEntry(parseGitStatusShort("?? chrome-extension/node_modules/pkg/index.js\n")[0])).toBe(true);
		expect(isSuspiciousWorkingTreeEntry(parseGitStatusShort("?? .pi/workflows/github-issue-driven-dev/current/test.log\n")[0])).toBe(false);
	});

	it("summarizes suspicious candidates separately", () => {
		const summary = summarizeWorkingTreeEntries(
			parseGitStatusShort("M  src/index.ts\n?? tmp/debug.log\n?? .pi/workflows/github-issue-driven-dev/current/test.log\n"),
		);
		expect(summary).toContain("## Working tree");
		expect(summary).toContain("[M ] src/index.ts");
		expect(summary).toContain("## Suspicious file candidates");
		expect(summary).toContain("[??] tmp/debug.log");
		expect(summary).toContain("## Suspicious file candidates\n- [??] tmp/debug.log");
	});
});
