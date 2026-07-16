import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "@earendil-works/pi-agent-core";
import { describe, expect, it } from "vitest";
import { AgentSession } from "../src/core/agent-session.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import type { ExtensionAPI, LoadedExtensionInfo } from "../src/index.ts";
import { createInMemoryModelRegistry, getModelRuntime } from "./model-runtime-test-utils.ts";
import { createTestExtensionsResult, createTestResourceLoader } from "./utilities.ts";

describe("ExtensionAPI.getExtensions", () => {
	it("returns a fresh snapshot with canonical metadata for every extension scope", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pi-extensions-api-"));
		try {
			const paths = {
				project: join(tempDir, "project/.pi/extensions/startup.ts"),
				user: join(tempDir, "agent/extensions/footer.ts"),
				package: join(tempDir, "project/.pi/npm/node_modules/example/extensions/index.ts"),
				cli: join(tempDir, "cli/temporary.ts"),
				inline: "<inline:status>",
			};
			let api: ExtensionAPI | undefined;
			const extensionsResult = await createTestExtensionsResult([
				{
					path: paths.project,
					factory: (pi) => {
						api = pi;
					},
				},
				{ path: paths.user, factory: () => {} },
				{ path: paths.package, factory: () => {} },
				{ path: paths.cli, factory: () => {} },
				{ path: paths.inline, factory: () => {} },
			]);
			const sourceMetadata = [
				{ path: paths.project, source: "local", scope: "project", origin: "top-level" },
				{ path: paths.user, source: "local", scope: "user", origin: "top-level" },
				{ path: paths.package, source: "npm:example", scope: "project", origin: "package" },
				{ path: paths.cli, source: "cli", scope: "temporary", origin: "top-level" },
				{ path: paths.inline, source: "inline", scope: "temporary", origin: "top-level" },
			] as const;
			for (const [index, sourceInfo] of sourceMetadata.entries()) {
				extensionsResult.extensions[index]!.sourceInfo = sourceInfo;
			}

			const session = new AgentSession({
				agent: new Agent({ initialState: { systemPrompt: "", tools: [] } }),
				sessionManager: SessionManager.inMemory(),
				settingsManager: SettingsManager.create(tempDir, tempDir),
				cwd: tempDir,
				modelRuntime: getModelRuntime(
					await createInMemoryModelRegistry(AuthStorage.create(join(tempDir, "auth.json"))),
				),
				resourceLoader: createTestResourceLoader({ extensionsResult }),
			});

			const expected: LoadedExtensionInfo[] = [
				{ name: "startup", path: paths.project, scope: "project", source: "local" },
				{ name: "footer", path: paths.user, scope: "user", source: "local" },
				{ name: "example", path: paths.package, scope: "package", source: "npm:example" },
				{ name: "temporary", path: paths.cli, scope: "cli", source: "cli" },
				{ name: "status", path: paths.inline, scope: "cli", source: "inline" },
			];
			expect(api?.getExtensions()).toEqual(expected);

			const firstSnapshot = api!.getExtensions();
			firstSnapshot.pop();
			expect(api?.getExtensions()).toEqual(expected);

			session.dispose();
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});
});
