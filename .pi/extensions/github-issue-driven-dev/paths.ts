import * as fs from "node:fs";
import * as path from "node:path";

export function repoPath(cwd: string, relativePath: string): string {
	return path.join(cwd, relativePath);
}

export function findProjectRoot(startDir: string): string {
	let currentDir = startDir;
	while (true) {
		if (fs.existsSync(path.join(currentDir, ".git")) || fs.existsSync(path.join(currentDir, ".pi"))) {
			return currentDir;
		}
		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) {
			return startDir;
		}
		currentDir = parentDir;
	}
}
