import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type BaselineKey,
	compareWithBaseline,
	createBaseline,
	readBaseline,
	writeBaseline,
} from "../../src/runner/baseline";

function finding(file: string, text: string, engine?: string): BaselineKey {
	const entry: BaselineKey = { file, rule: "placeholder-comment", text };
	if (engine !== undefined) {
		entry.engine = engine;
	}
	return entry;
}

/**
 * baseline fileを一時ディレクトリへ書き、後片付けする
 */
function withBaselineFile<T>(text: string, callback: (path: string) => T): T {
	const directory = mkdtempSync(join(tmpdir(), "baseline-"));
	try {
		const path = join(directory, "quality-baseline.json");
		writeFileSync(path, text, "utf8");
		return callback(path);
	} finally {
		rmSync(directory, { force: true, recursive: true });
	}
}

describe("baseline", () => {
	test("keeps a baselined finding out of the report", () => {
		const baseline = createBaseline([finding("src/a.ts", "TODO: one")]);
		const comparison = compareWithBaseline(
			[finding("src/a.ts", "TODO: one")],
			baseline,
		);
		expect(comparison.added).toHaveLength(0);
	});

	test("reports a finding that is not baselined", () => {
		const baseline = createBaseline([finding("src/a.ts", "TODO: one")]);
		const comparison = compareWithBaseline(
			[finding("src/a.ts", "TODO: one"), finding("src/b.ts", "TODO: two")],
			baseline,
		);
		expect(comparison.added.map((entry) => entry.file)).toEqual(["src/b.ts"]);
	});

	test("counts a repeated finding separately", () => {
		const baseline = createBaseline([finding("src/a.ts", "TODO: one")]);
		const comparison = compareWithBaseline(
			[finding("src/a.ts", "TODO: one"), finding("src/a.ts", "TODO: one")],
			baseline,
		);
		expect(comparison.added).toHaveLength(1);
	});

	test("keys on the engine as well as the rule and text", () => {
		const baseline = createBaseline([
			finding("src/a.ts", "TODO: one", "comment"),
		]);
		const comparison = compareWithBaseline(
			[finding("src/a.ts", "TODO: one", "tsdoc")],
			baseline,
		);
		expect(comparison.added).toHaveLength(1);
	});

	test("reports a baseline entry that no longer appears", () => {
		const baseline = createBaseline([finding("src/a.ts", "TODO: one")]);
		const comparison = compareWithBaseline([], baseline);
		expect(comparison.resolved).toHaveLength(1);
	});
});

describe("baseline file", () => {
	test.each([
		["code-style-check", "code"],
		["comment-check", "comment"],
		["document-style-check", "markdown"],
		["tsdoc-check", "tsdoc"],
		["custom-check", "custom-check"],
		["toString", "toString"],
	])(
		"preserves %s baseline identity and multiplicities as %s",
		(legacy, canonical) => {
			const legacyEntry = {
				...finding("src/a.ts", "TODO: one", legacy),
				count: 2,
			};
			const canonicalEntry = { ...legacyEntry, engine: canonical, count: 1 };
			const historical = {
				entries: [legacyEntry, canonicalEntry],
				version: 1 as const,
			};
			const original = JSON.stringify(historical);
			withBaselineFile(original, (path) => {
				const baseline = readBaseline(path);
				expect(baseline.entries).toEqual([
					{ ...legacyEntry, engine: canonical },
					canonicalEntry,
				]);
				expect(readFileSync(path, "utf8")).toBe(original);
				const current = finding("src/a.ts", "TODO: one", canonical);
				const findings = [current, current, current];
				expect(compareWithBaseline(findings, historical)).toEqual({
					added: [],
					resolved: [],
				});
				expect(compareWithBaseline(findings, baseline)).toEqual({
					added: [],
					resolved: [],
				});
				expect(compareWithBaseline([current, current], baseline)).toEqual({
					added: [],
					resolved: [{ ...canonicalEntry, count: 1 }],
				});
				expect(compareWithBaseline([...findings, current], baseline)).toEqual({
					added: [current],
					resolved: [],
				});
				writeBaseline(
					path,
					createBaseline([
						finding("src/a.ts", "TODO: one", legacy),
						current,
						current,
					]),
				);
				expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
					entries: [{ ...canonicalEntry, count: 3 }],
					version: 1,
				});
			});
		},
	);

	test("reads a version 1 baseline", () => {
		withBaselineFile('{"version":1,"entries":[]}', (path) => {
			expect(readBaseline(path)).toEqual({ entries: [], version: 1 });
		});
	});

	test("returns an empty baseline when the file is missing", () => {
		const directory = mkdtempSync(join(tmpdir(), "baseline-"));
		try {
			expect(readBaseline(join(directory, "quality-baseline.json"))).toEqual({
				entries: [],
				version: 1,
			});
		} finally {
			rmSync(directory, { force: true, recursive: true });
		}
	});

	test("rejects a baseline of another version", () => {
		withBaselineFile('{"version":2,"entries":[]}', (path) => {
			expect(() => readBaseline(path)).toThrow("is not a version 1 baseline");
		});
	});

	test("rejects a file without an entries array", () => {
		withBaselineFile('{"version":1}', (path) => {
			expect(() => readBaseline(path)).toThrow("is not a baseline");
		});
	});
});
