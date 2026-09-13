import { describe, expect, test } from "bun:test";
import { RULE_GROUPS, RULE_IDS } from "../src/rule-ids";
import {
	classifyComment,
	findJapanesePeriod,
	isCrampedComment,
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
	test("finds the first Japanese period of a comment body", () => {
		expect(findJapanesePeriod(" plain comment")).toBe(-1);
		expect(findJapanesePeriod(" 一つ。二つ。")).toBe(3);
	});

	test("detects a comment that starts under the previous line", () => {
		expect(isCrampedComment("const a = 1\n/**\n * b\n */\n", 12)).toBe(true);
	});

	test("accepts a blank line, a file start, and a block opener", () => {
		expect(isCrampedComment("const a = 1\n\n/**\n * b\n */\n", 13)).toBe(false);
		expect(isCrampedComment("/**\n * b\n */\n", 0)).toBe(false);
		expect(isCrampedComment("export interface A {\n\t/**\n", 21)).toBe(false);
	});

	test("accepts a comment that follows another comment", () => {
		expect(isCrampedComment("const a = 1\n// note\n/**\n * b\n */\n", 20)).toBe(
			false,
		);
	});
});

test("全てのruleがgroupへ重複なく入る", () => {
	const grouped = Object.values(RULE_GROUPS).flatMap((rules) => [...rules]);
	expect(grouped.slice().sort()).toEqual([...RULE_IDS].sort());
});
