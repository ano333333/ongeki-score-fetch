import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function createQueuedUserMessageHandler(pi: ExtensionAPI, content: string) {
	return async () => {
		pi.sendUserMessage(content, { deliverAs: "followUp" });
		return { queued: true, deliverAs: "followUp" };
	};
}
