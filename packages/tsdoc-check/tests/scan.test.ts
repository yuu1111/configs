import { describe, expect, test } from "bun:test";
import { scanSource } from "../src/scan";

function rulesOf(source: string): string[] {
	return scanSource(source, "src/sample.ts").map((finding) => finding.rule);
}

describe("tsdoc checks", () => {
	test("accepts a documented export", () => {
		const source = [
			"/** Runs the task",
			" * @param value - the value to use",
			" */",
			"export function run(value: number): void {}",
		].join("\n");
		expect(scanSource(source, "src/sample.ts")).toEqual([]);
	});

	test("reports a parameter that the signature does not declare", () => {
		const source = [
			"/** Runs the task",
			" * @param missing - the value to use",
			" */",
			"export function run(value: number): void {}",
		].join("\n");
		const findings = scanSource(source, "src/sample.ts");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.rule).toBe("param-mismatch");
		expect(findings[0]?.severity).toBe("error");
	});

	test("reports a type parameter that the declaration does not declare", () => {
		const source = [
			"/** Runs the task",
			" * @typeParam U - the value type",
			" */",
			"export function run<T>(value: T): T {",
			"\treturn value",
			"}",
		].join("\n");
		const findings = scanSource(source, "src/sample.ts");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.rule).toBe("type-param-mismatch");
	});

	test("reports a malformed tag as a syntax error", () => {
		const source = [
			"/** Runs the task",
			" * @param value the value",
			" */",
			"export function run(value: number): void {}",
		].join("\n");
		const findings = scanSource(source, "src/sample.ts");
		expect(rulesOf(source)).toEqual(["tsdoc-syntax"]);
		expect(findings[0]?.severity).toBe("error");
	});

	test("reports a tag that TSDoc does not define as a warning", () => {
		const source = [
			"/** Runs the task",
			" * @bogus",
			" */",
			"export function run(): void {}",
		].join("\n");
		const findings = scanSource(source, "src/sample.ts");
		expect(rulesOf(source)).toEqual(["tsdoc-tag"]);
		expect(findings[0]?.severity).toBe("warning");
	});

	test("warns about an exported declaration without a comment", () => {
		const findings = scanSource("export const value = 1\n", "src/sample.ts");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.rule).toBe("missing-doc");
		expect(findings[0]?.severity).toBe("warning");
	});

	test("ignores declarations that are not exported", () => {
		const source = [
			"/** Runs the task",
			" * @bogus",
			" */",
			"function run(): void {}",
		].join("\n");
		expect(rulesOf(source)).toEqual([]);
	});

	test("skips a file that does not parse", () => {
		expect(rulesOf("export function run( {")).toEqual([]);
	});
});
