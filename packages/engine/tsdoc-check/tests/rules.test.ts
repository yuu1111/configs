import { describe, expect, test } from "bun:test";
import { RULE_GROUPS, RULE_IDS, SCOPED_RULE_IDS } from "../src/rule-ids";
import { promoteFindings, returnsValue } from "../src/rules";
import { scanSource } from "../src/scan";

describe("rule promotion", () => {
	test("raises the selected rule to an error", () => {
		const source = "export const value = 1\n";
		const findings = scanSource(source, "src/sample.ts", ["missing-doc"]);
		const promoted = promoteFindings(findings, ["missing-doc"]);
		expect(promoted[0]?.severity).toBe("error");
	});

	test("keeps the other findings as they are", () => {
		const source = "export const value = 1\n";
		const findings = scanSource(source, "src/sample.ts", ["missing-doc"]);
		const promoted = promoteFindings(findings, ["tsdoc-tag"]);
		expect(promoted[0]?.severity).toBe("warning");
	});

	test("raises the undefined tag rule to an error", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @description the value read from the header",
			" */",
			"export function run(): void {}",
		].join("\n");
		const findings = scanSource(source, "src/sample.ts");
		const promoted = promoteFindings(findings, ["tsdoc-tag"]);

		expect(findings[0]?.rule).toBe("tsdoc-tag");
		expect(findings[0]?.severity).toBe("warning");
		expect(promoted[0]?.severity).toBe("error");
	});
});

describe("return value detection", () => {
	test("treats void, never, and undefined as no value", () => {
		expect(returnsValue("void")).toBe(false);
		expect(returnsValue("never")).toBe(false);
		expect(returnsValue("undefined")).toBe(false);
		expect(returnsValue("Promise<void>")).toBe(false);
		expect(returnsValue("PromiseLike<void>")).toBe(false);
	});

	test("treats a value and a union with void as a value", () => {
		expect(returnsValue("number")).toBe(true);
		expect(returnsValue("Promise<User>")).toBe(true);
		expect(returnsValue("number | undefined")).toBe(true);
		expect(returnsValue("void | never")).toBe(false);
	});
});

describe("rule groups", () => {
	test("covers every rule once", () => {
		const grouped = Object.values(RULE_GROUPS).flatMap((rules) => [...rules]);
		expect(grouped.slice().sort()).toEqual([...RULE_IDS].sort());
	});

	test("names only rules that the vocabulary defines", () => {
		for (const rule of SCOPED_RULE_IDS) {
			expect(RULE_IDS).toContain(rule);
		}
		expect(new Set(SCOPED_RULE_IDS).size).toBe(SCOPED_RULE_IDS.length);
	});
});
