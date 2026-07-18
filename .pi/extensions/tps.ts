import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function isAssistantMessage(message: unknown): message is AssistantMessage {
	if (!message || typeof message !== "object") return false;
	const role = (message as { role?: unknown }).role;
	return role === "assistant";
}

export default function (pi: ExtensionAPI) {
	let agentStartMs: number | null = null;
	let firstDeltaMs: number | null = null;
	let firstTextDeltaMs: number | null = null;
	let lastAssistantDeltaMs: number | null = null;

	pi.on("agent_start", () => {
		const now = Date.now();
		agentStartMs = now;
		firstDeltaMs = null;
		firstTextDeltaMs = null;
		lastAssistantDeltaMs = null;
	});

	pi.on("message_update", (event) => {
		const update = (event as any).assistantMessageEvent;
		if (!update || (update.type !== "thinking_delta" && update.type !== "text_delta")) return;
		const now = Date.now();
		firstDeltaMs ??= now;
		if (update.type === "text_delta") firstTextDeltaMs ??= now;
		lastAssistantDeltaMs = now;
	});

	pi.on("agent_end", (event, ctx) => {
		if (!ctx.hasUI) return;
		if (agentStartMs === null) return;

		const endedAt = Date.now();
		const startMs = agentStartMs;
		const elapsedMs = endedAt - startMs;
		const ttftMs = firstTextDeltaMs ?? firstDeltaMs;
		const generationStartMs = firstDeltaMs ?? startMs;
		const generationEndMs = lastAssistantDeltaMs ?? endedAt;
		agentStartMs = null;
		if (elapsedMs <= 0) return;

		let input = 0;
		let output = 0;
		let cacheRead = 0;
		let cacheWrite = 0;
		let totalTokens = 0;

		for (const message of event.messages) {
			if (!isAssistantMessage(message)) continue;
			input += message.usage.input || 0;
			output += message.usage.output || 0;
			cacheRead += message.usage.cacheRead || 0;
			cacheWrite += message.usage.cacheWrite || 0;
			totalTokens += message.usage.totalTokens || 0;
		}

		if (output <= 0) return;

		const elapsedSeconds = elapsedMs / 1000;
		const generationSeconds = Math.max((generationEndMs - generationStartMs) / 1000, 0.001);
		const tokensPerSecond = output / elapsedSeconds;
		const generationTps = output / generationSeconds;
		const ttft = ttftMs === null ? "TTFT n/a" : `TTFT ${(ttftMs - startMs).toLocaleString()}ms`;
		const message = `${ttft}. gen TPS ${generationTps.toFixed(1)} tok/s; wall TPS ${tokensPerSecond.toFixed(1)}. out ${output.toLocaleString()}, in ${input.toLocaleString()}, cache r/w ${cacheRead.toLocaleString()}/${cacheWrite.toLocaleString()}, total ${totalTokens.toLocaleString()}, ${elapsedSeconds.toFixed(1)}s`;
		ctx.ui.notify(message, "info");
	});
}
