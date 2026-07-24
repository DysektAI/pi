import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function isAssistantMessage(message: unknown): message is AssistantMessage {
	return !!message && typeof message === "object" && (message as { role?: unknown }).role === "assistant";
}

export default function (pi: ExtensionAPI) {
	let agentStartMs: number | null = null;
	let firstAssistantDeltaMs: number | null = null;
	let messageFirstDeltaMs: number | null = null;
	let messageLastDeltaMs: number | null = null;
	let generationDurationMs = 0;
	let assistantMessagesObserved = 0;
	let assistantIntervalsMeasured = 0;

	pi.on("agent_start", () => {
		agentStartMs = Date.now();
		firstAssistantDeltaMs = null;
		messageFirstDeltaMs = null;
		messageLastDeltaMs = null;
		generationDurationMs = 0;
		assistantMessagesObserved = 0;
		assistantIntervalsMeasured = 0;
	});

	pi.on("message_start", (event) => {
		if (!isAssistantMessage(event.message)) return;
		assistantMessagesObserved++;
		messageFirstDeltaMs = null;
		messageLastDeltaMs = null;
	});

	pi.on("message_update", (event) => {
		const update = event.assistantMessageEvent;
		if (update.type !== "text_delta" && update.type !== "thinking_delta" && update.type !== "toolcall_delta") {
			return;
		}
		const now = Date.now();
		firstAssistantDeltaMs ??= now;
		messageFirstDeltaMs ??= now;
		messageLastDeltaMs = now;
	});

	const finishAssistantInterval = (): void => {
		if (
			messageFirstDeltaMs !== null &&
			messageLastDeltaMs !== null &&
			messageLastDeltaMs > messageFirstDeltaMs
		) {
			generationDurationMs += messageLastDeltaMs - messageFirstDeltaMs;
			assistantIntervalsMeasured++;
		}
		messageFirstDeltaMs = null;
		messageLastDeltaMs = null;
	};

	pi.on("message_end", (event) => {
		if (!isAssistantMessage(event.message)) return;
		finishAssistantInterval();
	});

	pi.on("agent_end", (event, ctx) => {
		if (!ctx.hasUI || agentStartMs === null) return;
		const endedAt = Date.now();
		const startMs = agentStartMs;
		finishAssistantInterval();
		agentStartMs = null;
		const elapsedMs = endedAt - startMs;
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
		const ttft =
			firstAssistantDeltaMs === null
				? "TTFT n/a"
				: `TTFT ${(firstAssistantDeltaMs - startMs).toLocaleString()}ms`;
		const generationTps =
			generationDurationMs > 0 && assistantIntervalsMeasured === assistantMessagesObserved
				? `gen TPS ${(output / (generationDurationMs / 1000)).toFixed(1)} tok/s`
				: "gen TPS n/a";
		const message = `${ttft}. ${generationTps}; wall TPS ${(output / elapsedSeconds).toFixed(1)}. out ${output.toLocaleString()}, in ${input.toLocaleString()}, cache r/w ${cacheRead.toLocaleString()}/${cacheWrite.toLocaleString()}, total ${totalTokens.toLocaleString()}, ${elapsedSeconds.toFixed(1)}s`;
		ctx.ui.notify(message, "info");
	});
}
