import { existsSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChangelogEntry } from "../src/utils/changelog.ts";
import { compareVersions, getNewEntries, parseChangelog } from "../src/utils/changelog.ts";

describe("parseChangelog", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "changelog-test-"));
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
	});

	it("returns empty array for non-existent file", () => {
		expect(parseChangelog("/non/existent/CHANGELOG.md")).toEqual([]);
	});

	it("parses a single version entry", () => {
		const changelog = `# Changelog

## [1.2.3]

### Added
- New feature X
`;
		writeFileSync(join(tempDir, "CHANGELOG.md"), changelog);
		const entries = parseChangelog(join(tempDir, "CHANGELOG.md"));
		expect(entries).toHaveLength(1);
		expect(entries[0].major).toBe(1);
		expect(entries[0].minor).toBe(2);
		expect(entries[0].patch).toBe(3);
		expect(entries[0].content).toContain("New feature X");
	});

	it("parses multiple version entries", () => {
		const changelog = `# Changelog

## [2.0.0]

### Breaking Changes
- Removed old API

## [1.1.0]

### Added
- Feature A

## [1.0.0]

### Added
- Initial release
`;
		writeFileSync(join(tempDir, "CHANGELOG.md"), changelog);
		const entries = parseChangelog(join(tempDir, "CHANGELOG.md"));
		expect(entries).toHaveLength(3);
		expect(entries[0].major).toBe(2);
		expect(entries[1].minor).toBe(1);
		expect(entries[2].patch).toBe(0);
	});

	it("skips non-version headers like [Unreleased]", () => {
		const changelog = `# Changelog

## [Unreleased]

### Added
- Upcoming feature

## [1.0.0]

### Added
- First release
`;
		writeFileSync(join(tempDir, "CHANGELOG.md"), changelog);
		const entries = parseChangelog(join(tempDir, "CHANGELOG.md"));
		expect(entries).toHaveLength(1);
		expect(entries[0].major).toBe(1);
	});

	it("handles version without brackets", () => {
		const changelog = `## 0.5.2

### Fixed
- Bug fix
`;
		writeFileSync(join(tempDir, "CHANGELOG.md"), changelog);
		const entries = parseChangelog(join(tempDir, "CHANGELOG.md"));
		expect(entries).toHaveLength(1);
		expect(entries[0].major).toBe(0);
		expect(entries[0].minor).toBe(5);
		expect(entries[0].patch).toBe(2);
	});
});

describe("compareVersions", () => {
	function entry(major: number, minor: number, patch: number): ChangelogEntry {
		return { major, minor, patch, content: "" };
	}

	it("returns 0 for equal versions", () => {
		expect(compareVersions(entry(1, 2, 3), entry(1, 2, 3))).toBe(0);
	});

	it("compares major versions first", () => {
		expect(compareVersions(entry(2, 0, 0), entry(1, 9, 9))).toBeGreaterThan(0);
		expect(compareVersions(entry(1, 0, 0), entry(2, 0, 0))).toBeLessThan(0);
	});

	it("compares minor versions second", () => {
		expect(compareVersions(entry(1, 2, 0), entry(1, 1, 9))).toBeGreaterThan(0);
		expect(compareVersions(entry(1, 1, 0), entry(1, 2, 0))).toBeLessThan(0);
	});

	it("compares patch versions last", () => {
		expect(compareVersions(entry(1, 1, 2), entry(1, 1, 1))).toBeGreaterThan(0);
		expect(compareVersions(entry(1, 1, 1), entry(1, 1, 2))).toBeLessThan(0);
	});
});

describe("getNewEntries", () => {
	const entries: ChangelogEntry[] = [
		{ major: 2, minor: 0, patch: 0, content: "v2" },
		{ major: 1, minor: 1, patch: 0, content: "v1.1" },
		{ major: 1, minor: 0, patch: 0, content: "v1.0" },
	];

	it("returns entries newer than the given version", () => {
		const result = getNewEntries(entries, "1.0.0");
		expect(result).toHaveLength(2);
		expect(result[0].content).toBe("v2");
		expect(result[1].content).toBe("v1.1");
	});

	it("returns all entries when last version is 0.0.0", () => {
		const result = getNewEntries(entries, "0.0.0");
		expect(result).toHaveLength(3);
	});

	it("returns empty when last version is current", () => {
		const result = getNewEntries(entries, "2.0.0");
		expect(result).toHaveLength(0);
	});

	it("handles partial version strings gracefully", () => {
		const result = getNewEntries(entries, "1");
		expect(result).toHaveLength(2);
	});
});
