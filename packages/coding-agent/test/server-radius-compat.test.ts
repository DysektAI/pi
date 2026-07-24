import { afterEach, describe, expect, it } from "vitest";
import { getRadiusServerBaseUrl } from "../../server/src/radius.ts";

const originalServerUrl = process.env.PI_RADIUS_SERVER_URL;
const originalOrchestratorUrl = process.env.PI_RADIUS_ORCHESTRATOR_URL;

afterEach(() => {
	if (originalServerUrl === undefined) delete process.env.PI_RADIUS_SERVER_URL;
	else process.env.PI_RADIUS_SERVER_URL = originalServerUrl;
	if (originalOrchestratorUrl === undefined) delete process.env.PI_RADIUS_ORCHESTRATOR_URL;
	else process.env.PI_RADIUS_ORCHESTRATOR_URL = originalOrchestratorUrl;
});

describe("getRadiusServerBaseUrl", () => {
	it("falls back to the legacy URL when the current variable is empty", () => {
		process.env.PI_RADIUS_SERVER_URL = "";
		process.env.PI_RADIUS_ORCHESTRATOR_URL = "https://legacy.example.test";

		expect(getRadiusServerBaseUrl()).toBe("https://legacy.example.test");
	});
});
