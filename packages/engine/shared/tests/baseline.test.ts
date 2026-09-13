import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type BaselineKey,
	compareWithBaseline,
	createBaseline,
	readBaseline,
} from "../src/baseline";

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
			finding("src/a.ts", "TODO: one", "comment-check"),
		]);
		const comparison = compareWithBaseline(
			[finding("src/a.ts", "TODO: one", "tsdoc-check")],
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
