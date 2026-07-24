import { afterEach, describe, expect, it, vi } from "vitest";
import tpsExtension from "../../../.pi/extensions/tps.ts";

const assistantMessage = {
	role: "assistant" as const,
	content: [{ type: "text" as const, text: "done" }],
	api: "anthropic-messages" as const,
	provider: "test",
	model: "test",
	usage: {
		input: 10,
		output: 5,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 15,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	},
	stopReason: "stop" as const,
	timestamp: 1000,
};

afterEach(() => {
	vi.useRealTimers();
});

describe("TPS extension", () => {
	it("reports generation TPS as unavailable for a single-delta response", () => {
		vi.useFakeTimers();
		vi.setSystemTime(1000);
		const handlers = new Map<string, unknown>();
		const notify = vi.fn();
		const pi = {
			on: (event: string, handler: unknown) => {
				handlers.set(event, handler);
			},
		} as unknown as Parameters<typeof tpsExtension>[0];
		const emit = (event: string, ...args: unknown[]): void => {
			const handler = handlers.get(event) as ((...eventArgs: unknown[]) => void) | undefined;
			if (!handler) throw new Error(`Missing handler for ${event}`);
			handler(...args);
		};
		tpsExtension(pi);

		emit("agent_start", {});
		emit("message_start", { message: assistantMessage });
		vi.setSystemTime(1100);
		emit("message_update", { assistantMessageEvent: { type: "text_delta" } });
		emit("message_end", { message: assistantMessage });
		vi.setSystemTime(1200);
		emit("agent_end", { messages: [assistantMessage] }, { hasUI: true, ui: { notify } });

		expect(notify).toHaveBeenCalledOnce();
		expect(notify.mock.calls[0][0]).toContain("gen TPS n/a");
	});
});
