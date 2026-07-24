import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventBus } from "../src/core/event-bus.ts";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("createEventBus", () => {
	it("invokes synchronous listeners before emit returns", () => {
		const bus = createEventBus();
		const order: string[] = [];
		bus.on("test", () => {
			order.push("listener");
		});

		order.push("before");
		bus.emit("test", undefined);
		order.push("after");

		expect(order).toEqual(["before", "listener", "after"]);
	});

	it("reports both the listener error and a rejected error handler", async () => {
		const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
		const bus = createEventBus(async () => {
			throw new Error("secondary");
		});
		bus.on("test", async () => {
			throw new Error("primary");
		});

		bus.emit("test", undefined);

		await vi.waitFor(() => expect(stderr).toHaveBeenCalledTimes(2));
		const output = stderr.mock.calls.map(([chunk]) => String(chunk)).join("");
		expect(output).toContain("Event handler error (test): primary");
		expect(output).toContain("Event error-handler failure (test): secondary");
	});
});
