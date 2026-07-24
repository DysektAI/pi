import { AsyncLocalStorage } from "node:async_hooks";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import type { SQLInputValue } from "node:sqlite";
import { DatabaseSync } from "node:sqlite";
import type { SqliteDatabase, SqliteDatabaseFactory, SqliteRunResult, SqliteStatement } from "./sqlite/types.ts";

interface TransactionQueue {
	tail: Promise<void>;
	refs: number;
}

const transactionQueues = new Map<string, TransactionQueue>();
const activeTransactionQueues = new AsyncLocalStorage<ReadonlySet<TransactionQueue>>();

function isNamedParameters(value: unknown): value is Record<string, SQLInputValue> {
	if (value === null || typeof value !== "object") return false;
	if (Array.isArray(value) || ArrayBuffer.isView(value)) return false;
	return true;
}

function getTransactionQueueKey(path: string): string | undefined {
	if (path === ":memory:" || path === "") return undefined;
	if (path.startsWith("file:")) return `uri:${path}`;
	try {
		const stat = statSync(path);
		return `file:${stat.dev}:${stat.ino}`;
	} catch {
		return `path:${resolve(path)}`;
	}
}

class NodeSqliteStatement implements SqliteStatement {
	private readonly statement: ReturnType<DatabaseSync["prepare"]>;

	constructor(statement: ReturnType<DatabaseSync["prepare"]>) {
		this.statement = statement;
	}

	async run(...params: unknown[]): Promise<SqliteRunResult> {
		const [first, ...rest] = params;
		const result = isNamedParameters(first)
			? this.statement.run(first, ...(rest as SQLInputValue[]))
			: this.statement.run(...(params as SQLInputValue[]));
		return {
			changes: Number(result.changes),
			lastInsertRowid: result.lastInsertRowid === undefined ? undefined : Number(result.lastInsertRowid),
		};
	}

	async get<TRow extends object>(...params: unknown[]): Promise<TRow | undefined> {
		const [first, ...rest] = params;
		return (
			isNamedParameters(first)
				? this.statement.get(first, ...(rest as SQLInputValue[]))
				: this.statement.get(...(params as SQLInputValue[]))
		) as TRow | undefined;
	}

	async all<TRow extends object>(...params: unknown[]): Promise<TRow[]> {
		const [first, ...rest] = params;
		return (
			isNamedParameters(first)
				? this.statement.all(first, ...(rest as SQLInputValue[]))
				: this.statement.all(...(params as SQLInputValue[]))
		) as TRow[];
	}
}

class NodeSqliteDatabase implements SqliteDatabase {
	private readonly db: DatabaseSync;
	private readonly transactionQueue: TransactionQueue;
	private readonly queueKey: string | undefined;
	private closed = false;

	constructor(
		db: DatabaseSync,
		transactionQueue: TransactionQueue = { tail: Promise.resolve(), refs: 1 },
		queueKey?: string,
	) {
		this.db = db;
		this.transactionQueue = transactionQueue;
		this.queueKey = queueKey;
	}

	async exec(sql: string): Promise<void> {
		this.db.exec(sql);
	}

	prepare(sql: string): SqliteStatement {
		return new NodeSqliteStatement(this.db.prepare(sql));
	}

	async transaction<T>(fn: () => Promise<T>): Promise<T> {
		const activeQueues = activeTransactionQueues.getStore();
		if (activeQueues?.has(this.transactionQueue)) {
			throw new Error("Nested transactions on the same SQLite database are not supported");
		}

		const previous = this.transactionQueue.tail;
		let release: () => void = () => {};
		this.transactionQueue.tail = new Promise<void>((resolveQueue) => {
			release = resolveQueue;
		});
		await previous;
		try {
			this.db.exec("BEGIN IMMEDIATE");
			try {
				const nextActiveQueues = new Set(activeQueues);
				nextActiveQueues.add(this.transactionQueue);
				let result: T;
				try {
					result = await activeTransactionQueues.run(nextActiveQueues, fn);
				} finally {
					// Async resources created by fn inherit this Set. Remove the marker
					// once the callback settles so later detached work is not misclassified.
					nextActiveQueues.delete(this.transactionQueue);
				}
				this.db.exec("COMMIT");
				return result;
			} catch (error) {
				try {
					this.db.exec("ROLLBACK");
				} catch {
					// Ignore rollback errors to rethrow original error.
				}
				throw error;
			}
		} finally {
			release();
		}
	}

	async close(): Promise<void> {
		if (this.closed) return;
		this.db.close();
		this.closed = true;
		if (!this.queueKey) return;
		this.transactionQueue.refs--;
		if (this.transactionQueue.refs === 0 && transactionQueues.get(this.queueKey) === this.transactionQueue) {
			transactionQueues.delete(this.queueKey);
		}
	}
}

export function wrapNodeSqliteDatabase(db: DatabaseSync): SqliteDatabase {
	return new NodeSqliteDatabase(db);
}

export function createNodeSqliteFactory(): SqliteDatabaseFactory {
	return {
		async open(path: string): Promise<SqliteDatabase> {
			const db = new DatabaseSync(path);
			const queueKey = getTransactionQueueKey(path);
			if (!queueKey) return new NodeSqliteDatabase(db);

			let queue = transactionQueues.get(queueKey);
			if (queue) {
				queue.refs++;
			} else {
				queue = { tail: Promise.resolve(), refs: 1 };
				transactionQueues.set(queueKey, queue);
			}
			return new NodeSqliteDatabase(db, queue, queueKey);
		},
	};
}

// Re-export the SQLite session storage backend and types so this package is a complete node-sqlite backend.
export * from "./sqlite/index.ts";
