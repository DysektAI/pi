import { uuidv7 } from "@earendil-works/pi-ai";
import {
	type FileError,
	type Result,
	SessionError,
	type SessionMetadata,
	type SessionStorage,
	type SessionTreeEntry,
} from "../types.ts";
import { Session } from "./session.ts";

export function createSessionId(): string {
	return uuidv7();
}

export function createTimestamp(): string {
	return new Date().toISOString();
}

export function toSession<TMetadata extends SessionMetadata>(storage: SessionStorage<TMetadata>): Session<TMetadata> {
	return new Session(storage);
}

export function getFileSystemResultOrThrow<TValue>(result: Result<TValue, FileError>, message: string): TValue {
	if (!result.ok) {
		const code = result.error.code === "not_found" ? "not_found" : "storage";
		throw new SessionError(code, `${message}: ${result.error.message}`, result.error);
	}
	return result.value;
}

export interface CompactionTraversalState {
	stop: boolean;
	stopAtEntryId: string | null;
}

/** Apply the shared compaction-boundary rules while walking a path from leaf to root. */
export function advanceCompactionTraversal(
	entry: SessionTreeEntry,
	stopAtEntryId: string | null,
): CompactionTraversalState {
	if (stopAtEntryId !== null && entry.id === stopAtEntryId) {
		return { stop: true, stopAtEntryId };
	}
	if (entry.type === "compaction") {
		if (entry.retainedTail) return { stop: true, stopAtEntryId };
		return { stop: false, stopAtEntryId: entry.firstKeptEntryId ?? null };
	}
	return { stop: false, stopAtEntryId };
}

export async function getEntriesToFork(
	storage: SessionStorage,
	options: { entryId?: string; position?: "before" | "at" },
): Promise<SessionTreeEntry[]> {
	if (!options.entryId) return storage.getEntries();
	const target = await storage.getEntry(options.entryId);
	if (!target) {
		throw new SessionError("invalid_fork_target", `Entry ${options.entryId} not found`);
	}
	let effectiveLeafId: string | null;
	if ((options.position ?? "before") === "at") {
		effectiveLeafId = target.id;
	} else {
		if (target.type !== "message" || target.message.role !== "user") {
			throw new SessionError("invalid_fork_target", `Entry ${options.entryId} is not a user message`);
		}
		effectiveLeafId = target.parentId;
	}
	return storage.getPathToRootOrCompaction(effectiveLeafId);
}
