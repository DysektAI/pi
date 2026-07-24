import { EventEmitter } from "node:events";

export interface EventBus {
	emit(channel: string, data: unknown): void;
	on(channel: string, handler: (data: unknown) => void | Promise<void>): () => void;
}

export type EventBusErrorHandler = (channel: string, error: unknown) => void | Promise<void>;

export interface EventBusController extends EventBus {
	clear(): void;
}

export function createEventBus(onError?: EventBusErrorHandler): EventBusController {
	const emitter = new EventEmitter();
	return {
		emit: (channel, data) => {
			emitter.emit(channel, data);
		},
		on: (channel, handler) => {
			const reportError = (label: string, error: unknown): void => {
				process.stderr.write(`${label} (${channel}): ${error instanceof Error ? error.message : String(error)}\n`);
			};
			const handleError = async (error: unknown): Promise<void> => {
				if (!onError) {
					reportError("Event handler error", error);
					return;
				}
				try {
					await onError(channel, error);
				} catch (onErrorFailure) {
					reportError("Event handler error", error);
					reportError("Event error-handler failure", onErrorFailure);
				}
			};
			const safeHandler = (data: unknown): void => {
				try {
					const result = handler(data);
					if (result instanceof Promise) void result.catch(handleError);
				} catch (error) {
					void handleError(error);
				}
			};
			emitter.on(channel, safeHandler);
			return () => emitter.off(channel, safeHandler);
		},
		clear: () => {
			emitter.removeAllListeners();
		},
	};
}
