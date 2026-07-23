import { compare, valid } from "semver";
import { getPiUserAgent } from "./pi-user-agent.ts";

// Pi checks this URL for the latest version. Our fork uses GitHub Releases
// instead of pi.dev so that every push to the `local` branch (which triggers
// a CI release) is automatically picked up by `pi update --self`.
//
// Set PI_UPDATE_API_URL to override. Example:
//   export PI_UPDATE_API_URL=https://api.github.com/repos/DysektAI/pi/releases/latest
const UPSTREAM_VERSION_URL = "https://pi.dev/api/latest-version";
const FORK_RELEASES_URL = "https://api.github.com/repos/DysektAI/pi/releases/latest";
const DEFAULT_VERSION_CHECK_TIMEOUT_MS = 10000;

export interface LatestPiRelease {
	version: string;
	packageName?: string;
	note?: string;
}

export function comparePackageVersions(leftVersion: string, rightVersion: string): number | undefined {
	const left = valid(leftVersion.trim());
	const right = valid(rightVersion.trim());
	if (!left || !right) {
		return undefined;
	}
	return compare(left, right);
}

export function isNewerPackageVersion(candidateVersion: string, currentVersion: string): boolean {
	const comparison = comparePackageVersions(candidateVersion, currentVersion);
	if (comparison !== undefined) {
		return comparison > 0;
	}
	return candidateVersion.trim() !== currentVersion.trim();
}

function stripLeadingV(version: string): string {
	return version.startsWith("v") ? version.slice(1) : version;
}

async function fetchLatestFromGitHub(url: string, currentVersion: string, timeoutMs: number): Promise<LatestPiRelease | undefined> {
	const response = await fetch(url, {
		headers: {
			"User-Agent": getPiUserAgent(currentVersion),
			accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
		},
		signal: AbortSignal.timeout(timeoutMs),
	});
	if (!response.ok) return undefined;

	const data = (await response.json()) as {
		tag_name?: unknown;
		body?: unknown;
	};
	if (typeof data.tag_name !== "string" || !data.tag_name.trim()) {
		return undefined;
	}
	const version = stripLeadingV(data.tag_name.trim());
	const note = typeof data.body === "string" && data.body.trim() ? data.body.trim() : undefined;
	return { version, ...(note ? { note } : {}) };
}

export async function getLatestPiRelease(
	currentVersion: string,
	options: { timeoutMs?: number } = {},
): Promise<LatestPiRelease | undefined> {
	if (process.env.PI_OFFLINE) return undefined;

	const timeoutMs = options.timeoutMs ?? DEFAULT_VERSION_CHECK_TIMEOUT_MS;

	// Allow override via env var for custom update servers
	if (process.env.PI_UPDATE_API_URL) {
		return fetchLatestFromGitHub(process.env.PI_UPDATE_API_URL, currentVersion, timeoutMs);
	}

	// Try fork releases first; fall back to upstream pi.dev on failure
	const forkRelease = await fetchLatestFromGitHub(FORK_RELEASES_URL, currentVersion, timeoutMs);
	if (forkRelease) return forkRelease;

	const response = await fetch(UPSTREAM_VERSION_URL, {
		headers: {
			"User-Agent": getPiUserAgent(currentVersion),
			accept: "application/json",
		},
		signal: AbortSignal.timeout(timeoutMs),
	});
	if (!response.ok) return undefined;

	const data = (await response.json()) as {
		packageName?: unknown;
		version?: unknown;
		note?: unknown;
	};
	if (typeof data.version !== "string" || !data.version.trim()) {
		return undefined;
	}
	const packageName =
		typeof data.packageName === "string" && data.packageName.trim() ? data.packageName.trim() : undefined;
	const note = typeof data.note === "string" && data.note.trim() ? data.note.trim() : undefined;
	return {
		version: data.version.trim(),
		packageName,
		...(note ? { note } : {}),
	};
}

export async function getLatestPiVersion(
	currentVersion: string,
	options: { timeoutMs?: number } = {},
): Promise<string | undefined> {
	return (await getLatestPiRelease(currentVersion, options))?.version;
}

export async function checkForNewPiVersion(currentVersion: string): Promise<LatestPiRelease | undefined> {
	if (process.env.PI_SKIP_VERSION_CHECK) return undefined;

	try {
		const latestRelease = await getLatestPiRelease(currentVersion);
		if (latestRelease && isNewerPackageVersion(latestRelease.version, currentVersion)) {
			return latestRelease;
		}
		return undefined;
	} catch {
		return undefined;
	}
}
