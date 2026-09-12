import { describe, expect, test } from "bun:test";
import {
	classifyComment,
	findJapanesePeriod,
	parseEnabledRules,
} from "../src/rules";

describe("comment classification", () => {
	test("flags file-wide suppressions", () => {
		expect(
			classifyComment(" biome-ignore-all lint/suspicious/noDebugger: reason"),
		).toBe("broad-suppression");
		expect(classifyComment(" @ts-nocheck")).toBe("broad-suppression");
		expect(classifyComment(" eslint-disable")).toBe("broad-suppression");
	});

	test("requires a description on TypeScript directives", () => {
		expect(classifyComment(" @ts-expect-error")).toBe("undocumented-directive");
		expect(classifyComment(" @ts-ignore:")).toBe("undocumented-directive");
		expect(
			classifyComment(" @ts-expect-error - upstream type is wrong"),
		).toBeNull();
	});

	test("flags placeholder and separator comments", () => {
		expect(classifyComment(" TODO: remove the fallback")).toBe(
			"placeholder-comment",
		);
		expect(classifyComment(" FIXME window is not defined")).toBe(
			"placeholder-comment",
		);
		expect(classifyComment(" ----------------")).toBe("separator-comment");
		expect(classifyComment("*\n * ========\n ")).toBe("separator-comment");
	});

	test("accepts descriptive comments", () => {
		expect(
			classifyComment(" biome-ignore lint/suspicious/noExplicitAny: fixture"),
		).toBeNull();
		expect(classifyComment(" Returns the parsed header")).toBeNull();
	});
});

describe("opt-in rules", () => {
	test("accepts the Japanese period rule without duplicates", () => {
		expect(parseEnabledRules([])).toEqual([]);
		expect(parseEnabledRules(["japanese-period"])).toEqual(["japanese-period"]);
		expect(parseEnabledRules(["japanese-period", "japanese-period"])).toEqual([
			"japanese-period",
		]);
	});

	test("rejects an unknown rule name", () => {
		expect(() => parseEnabledRules(["period"])).toThrow("unknown rule: period");
	});

	test("finds the first Japanese period of a comment body", () => {
		expect(findJapanesePeriod(" plain comment")).toBe(-1);
		expect(findJapanesePeriod(" 一つ。二つ。")).toBe(3);
	});
});
