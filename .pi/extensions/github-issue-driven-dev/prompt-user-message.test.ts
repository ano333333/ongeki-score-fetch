import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueuedUserMessageHandler } from "./handlers/prompt-user-message.ts";

describe("createQueuedUserMessageHandler", () => {
	const sendUserMessage = vi.fn();
	const pi = { sendUserMessage } as const;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("queues the workflow guidance as a follow-up user message", async () => {
		const handler = createQueuedUserMessageHandler(pi as never, "hello");
		await expect(handler()).resolves.toEqual({ queued: true, deliverAs: "followUp" });
		expect(sendUserMessage).toHaveBeenCalledWith("hello", { deliverAs: "followUp" });
	});
});
