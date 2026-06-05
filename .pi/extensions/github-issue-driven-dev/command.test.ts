import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runCommandStreaming } from "./command.ts";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock("node:child_process", () => ({
	spawn: spawnMock,
}));

function createProc() {
	const proc = new EventEmitter() as EventEmitter & {
		stdout: EventEmitter;
		stderr: EventEmitter;
	};
	proc.stdout = new EventEmitter();
	proc.stderr = new EventEmitter();
	return proc;
}

describe("runCommandStreaming", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("treats signal-terminated processes as non-zero exits and exposes the signal", async () => {
		spawnMock.mockImplementation(() => {
			const proc = createProc();
			queueMicrotask(() => {
				proc.emit("close", null, "SIGTERM");
			});
			return proc;
		});

		await expect(runCommandStreaming("echo test", "/repo")).resolves.toEqual({
			exitCode: 128,
			stdout: "",
			stderr: "",
			signal: "SIGTERM",
		});
	});
});
