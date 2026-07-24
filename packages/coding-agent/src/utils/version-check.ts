import { compare, valid } from "semver";
import { detectInstallMethod } from "../config.ts";
import { getPiUserAgent } from "./pi-user-agent.ts";

const UPSTREAM_VERSION_URL = "https://pi.dev/api/latest-version";
const FORK_RELEASES_URL = "https://api.github.com/repos/DysektAI/pi/releases/latest";
const DEFAULT_VERSION_CHECK_TIMEOUT_MS = 10000;

export interface LatestPiRelease {
	version: string;
	packageName?: string;
	note?: string;
	url?: string;
}

export function comparePackageVersions(leftVersion: string, rightVersion: string): number | undefined {
	const left = valid(leftVersion.trim());
	const right = valid(rightVersion.trim());
	if (!left || !right) return undefined;
	return compare(left, right);
}

export function isNewerPackageVersion(candidateVersion: string, currentVersion: string): boolean {
	const comparison = comparePackageVersions(candidateVersion, currentVersion);
	return comparison === undefined ? candidateVersion.trim() !== currentVersion.trim() : comparison > 0;
}

function stripLeadingV(version: string): string {
	return version.startsWith("v") ? version.slice(1) : version;
}

function remainingTimeout(deadline: number): number {
	return Math.max(1, deadline - Date.now());
}

async function fetchLatestFromGitHub(
	url: string,
	currentVersion: string,
	timeoutMs: number,
): Promise<LatestPiRelease | undefined> {
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
		html_url?: unknown;
	};
	if (typeof data.tag_name !== "string" || !data.tag_name.trim()) return undefined;
	const note = typeof data.body === "string" && data.body.trim() ? data.body.trim() : undefined;
	const releaseUrl = typeof data.html_url === "string" && data.html_url.trim() ? data.html_url.trim() : undefined;
	return {
		version: stripLeadingV(data.tag_name.trim()),
		...(note ? { note } : {}),
		...(releaseUrl ? { url: releaseUrl } : {}),
	};
}

async function fetchLatestFromUpstream(
	currentVersion: string,
	timeoutMs: number,
): Promise<LatestPiRelease | undefined> {
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
	if (typeof data.version !== "string" || !data.version.trim()) return undefined;
	const packageName =
		typeof data.packageName === "string" && data.packageName.trim() ? data.packageName.trim() : undefined;
	const note = typeof data.note === "string" && data.note.trim() ? data.note.trim() : undefined;
	return {
		version: data.version.trim(),
		...(packageName ? { packageName } : {}),
		...(note ? { note } : {}),
	};
}

export async function getLatestPiRelease(
	currentVersion: string,
	options: { timeoutMs?: number } = {},
): Promise<LatestPiRelease | undefined> {
	if (process.env.PI_OFFLINE) return undefined;
	const timeoutMs = options.timeoutMs ?? DEFAULT_VERSION_CHECK_TIMEOUT_MS;
	const deadline = Date.now() + timeoutMs;

	if (process.env.PI_UPDATE_API_URL) {
		return fetchLatestFromGitHub(process.env.PI_UPDATE_API_URL, currentVersion, remainingTimeout(deadline));
	}

	// Fork releases are source-only. Package-manager installs must continue to
	// use the published upstream package rather than an unpublishable fork tag.
	if (detectInstallMethod() === "source") {
		try {
			const forkRelease = await fetchLatestFromGitHub(FORK_RELEASES_URL, currentVersion, remainingTimeout(deadline));
			if (forkRelease) return forkRelease;
		} catch {
			// Preserve upstream checks when GitHub is unavailable or malformed.
		}
	}

	return fetchLatestFromUpstream(currentVersion, remainingTimeout(deadline));
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
		return latestRelease && isNewerPackageVersion(latestRelease.version, currentVersion) ? latestRelease : undefined;
	} catch {
		return undefined;
	}
}
