import { describe, expect, test } from "bun:test";
import { compareWithBaseline, createBaseline } from "../src/baseline";
import type { NormalizedFinding } from "../src/findings";

function finding(
	engine: NormalizedFinding["engine"],
	file: string,
	text: string,
): NormalizedFinding {
	return {
		column: 1,
		engine,
		file,
		line: 1,
		rule: "placeholder-comment",
		severity: "error",
		text,
	};
}

describe("quality baseline", () => {
	test("keeps a baselined finding out of the report", () => {
		const baseline = createBaseline([
			finding("comment-check", "src/a.ts", "x"),
		]);
		const comparison = compareWithBaseline(
			[finding("comment-check", "src/a.ts", "x")],
			baseline,
		);
		expect(comparison.added).toHaveLength(0);
	});

	test("reports a finding that is not baselined", () => {
		const baseline = createBaseline([
			finding("comment-check", "src/a.ts", "x"),
		]);
		const comparison = compareWithBaseline(
			[
				finding("comment-check", "src/a.ts", "x"),
				finding("comment-check", "src/b.ts", "y"),
			],
			baseline,
		);
		expect(comparison.added.map((entry) => entry.file)).toEqual(["src/b.ts"]);
	});

	test("counts a repeated finding separately", () => {
		const baseline = createBaseline([
			finding("comment-check", "src/a.ts", "x"),
		]);
		const comparison = compareWithBaseline(
			[
				finding("comment-check", "src/a.ts", "x"),
				finding("comment-check", "src/a.ts", "x"),
			],
			baseline,
		);
		expect(comparison.added).toHaveLength(1);
	});

	test("keys on the engine as well as the rule and text", () => {
		const baseline = createBaseline([
			finding("comment-check", "src/a.ts", "x"),
		]);
		const comparison = compareWithBaseline(
			[finding("tsdoc-check", "src/a.ts", "x")],
			baseline,
		);
		expect(comparison.added).toHaveLength(1);
	});

	test("reports a baseline entry that no longer appears", () => {
		const baseline = createBaseline([
			finding("comment-check", "src/a.ts", "x"),
		]);
		const comparison = compareWithBaseline([], baseline);
		expect(comparison.resolved).toHaveLength(1);
	});
});
