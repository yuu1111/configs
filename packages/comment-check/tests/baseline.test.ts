import { describe, expect, test } from "bun:test";
import { compareWithBaseline, createBaseline } from "../src/baseline";
import type { Finding } from "../src/rules";

function finding(file: string, text: string): Finding {
	return { column: 1, file, line: 1, rule: "placeholder-comment", text };
}

describe("comment baseline", () => {
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

	test("reports a baseline entry that no longer appears", () => {
		const baseline = createBaseline([finding("src/a.ts", "TODO: one")]);
		const comparison = compareWithBaseline([], baseline);
		expect(comparison.resolved).toHaveLength(1);
	});
});
