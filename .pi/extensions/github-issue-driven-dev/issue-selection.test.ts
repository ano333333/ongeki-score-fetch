import { describe, expect, it } from "vitest";
import {
	extractDependencies,
	formatSelectionRequestMarkdown,
	parseGitHubRepoFromRemote,
	parseSelectionRequest,
} from "./issue-selection.ts";

describe("github-issue-driven-dev issue selection helpers", () => {
	it("parses explicit issue number requests", () => {
		expect(parseSelectionRequest("63,現状のレビューと修正を行ってください")).toEqual({
			raw: "63,現状のレビューと修正を行ってください",
			explicitIssueNumber: 63,
			hasExplicitIssueNumber: true,
			overridesDefaultCriteria: true,
		});
		expect(parseSelectionRequest("please handle #24 next")).toEqual({
			raw: "please handle #24 next",
			explicitIssueNumber: 24,
			hasExplicitIssueNumber: true,
			overridesDefaultCriteria: true,
		});
	});

	it("treats empty requests as default-criteria selection", () => {
		expect(parseSelectionRequest("   ")).toEqual({
			raw: "",
			explicitIssueNumber: null,
			hasExplicitIssueNumber: false,
			overridesDefaultCriteria: false,
		});
	});

	it("formats selection request markdown with explicit override guidance", () => {
		const markdown = formatSelectionRequestMarkdown("63,現状のレビューと修正を行ってください");
		expect(markdown).toContain("Explicit issue request detected: #63");
		expect(markdown).toContain("overrides the default automatic criteria");
		expect(markdown).toContain("## Default automatic criteria");
	});

	it("extracts and deduplicates same-repo and cross-repo dependencies", () => {
		const dependencies = extractDependencies(
			"blocked by #17\nDepends on owner/repo#9\nblocked by #17\ndepends on owner/repo#9",
			"ano333333/ongeki-score-fetch",
		);
		expect(dependencies).toEqual([
			{ repo: "owner/repo", number: 9 },
			{ repo: "ano333333/ongeki-score-fetch", number: 17 },
		]);
	});

	it("parses GitHub repos from ssh and https remotes", () => {
		expect(parseGitHubRepoFromRemote("git@github.com:owner/repo.git")).toBe("owner/repo");
		expect(parseGitHubRepoFromRemote("https://github.com/owner/repo.git")).toBe("owner/repo");
		expect(parseGitHubRepoFromRemote("https://example.com/owner/repo.git")).toBeNull();
	});
});
