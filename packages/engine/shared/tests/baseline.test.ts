import { describe, expect, test } from "bun:test";
import {
	type BaselineKey,
	compareWithBaseline,
	createBaseline,
} from "../src/baseline";

function finding(file: string, text: string, engine?: string): BaselineKey {
	const entry: BaselineKey = { file, rule: "placeholder-comment", text };
	if (engine !== undefined) {
		entry.engine = engine;
	}
	return entry;
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
