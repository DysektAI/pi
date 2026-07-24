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
			const reportError = (error: unknown): void => {
				process.stderr.write(
					`Event handler error (${channel}): ${error instanceof Error ? error.message : String(error)}\n`,
				);
			};
			const safeHandler = (data: unknown): void => {
				Promise.resolve()
					.then(() => handler(data))
					.catch(async (error: unknown) => {
						if (!onError) {
							reportError(error);
							return;
						}
						try {
							await onError(channel, error);
						} catch (onErrorFailure) {
							reportError(onErrorFailure);
						}
					});
			};
			emitter.on(channel, safeHandler);
			return () => emitter.off(channel, safeHandler);
		},
		clear: () => {
			emitter.removeAllListeners();
		},
	};
}
