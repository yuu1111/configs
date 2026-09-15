import { describe, expect, test } from "bun:test";
import { scanSource } from "../src/scan";

function rulesOf(source: string): string[] {
	return scanSource(source, "src/sample.ts").map((finding) => finding.rule);
}

describe("tsdoc checks", () => {
	test("accepts a documented export", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @param value - the value to use",
			" */",
			"export function run(value: number): void {}",
		].join("\n");
		expect(scanSource(source, "src/sample.ts")).toEqual([]);
	});

	test("reports a TSDoc comment written on a single line", () => {
		const source = "/** Runs the task */\nexport function run(): void {}\n";
		const findings = scanSource(source, "src/sample.ts");
		expect(rulesOf(source)).toEqual(["single-line-doc"]);
		expect(findings[0]?.severity).toBe("warning");
	});

	test("reports a tag written directly under the summary", () => {
		const source = [
			"/** Reads the value",
			" * @param value - the value to read",
			" * @returns the value",
			" */",
			"export function read(value: number): number {",
			"\treturn value",
			"}",
		].join("\n");
		const findings = scanSource(source, "src/sample.ts");
		expect(findings.map((finding) => finding.rule)).toEqual([
			"blank-line-before-tags",
		]);
		expect(findings[0]?.severity).toBe("warning");
		expect(findings[0]?.line).toBe(2);
		expect(findings[0]?.column).toBe(4);
	});

	test("accepts a blank line before the tags", () => {
		const source = [
			"/** Reads the value",
			" *",
			" * @param value - the value to read",
			" * @returns the value",
			" */",
			"export function read(value: number): number {",
			"\treturn value",
			"}",
		].join("\n");
		expect(scanSource(source, "src/sample.ts")).toEqual([]);
	});

	test("accepts tags without a summary", () => {
		const source = [
			"/**",
			" * @param value - the value to read",
			" */",
			"export function read(value: number): void {}",
		].join("\n");
		expect(scanSource(source, "src/sample.ts")).toEqual([]);
	});

	test("reports a parameter that the signature does not declare", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @param missing - the value to use",
			" */",
			"export function run(value: number): void {}",
		].join("\n");
		const findings = scanSource(source, "src/sample.ts");
		expect(rulesOf(source).sort()).toEqual([
			"param-mismatch",
			"param-untagged",
		]);
		expect(
			findings.find((finding) => finding.rule === "param-mismatch")?.severity,
		).toBe("error");
	});

	test("reports a type parameter that the declaration does not declare", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @typeParam U - the value type",
			" */",
			"export function run<T>(value: T): T {",
			"\treturn value",
			"}",
		].join("\n");
		const findings = scanSource(source, "src/sample.ts");
		expect(rulesOf(source).sort()).toEqual([
			"param-untagged",
			"type-param-mismatch",
			"type-param-untagged",
		]);
		expect(
			findings.find((finding) => finding.rule === "type-param-mismatch")
				?.severity,
		).toBe("error");
	});

	test("reports a malformed tag as a syntax error", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @param value the value",
			" */",
			"export function run(value: number): void {}",
		].join("\n");
		const findings = scanSource(source, "src/sample.ts");
		expect(rulesOf(source)).toEqual(["tsdoc-syntax"]);
		expect(findings[0]?.severity).toBe("error");
	});

	test("reports the @description tag that TSDoc does not define", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @description the value read from the header",
			" */",
			"export function run(): void {}",
		].join("\n");
		const findings = scanSource(source, "src/sample.ts");

		expect(rulesOf(source)).toEqual(["tsdoc-tag"]);
		expect(findings[0]?.severity).toBe("warning");
	});

	test("does not report a multi-line TSDoc comment as a single line", () => {
		const source = [
			"/** Runs the task",
			" * and returns nothing",
			" */",
			"export function run(): void {}",
		].join("\n");

		expect(rulesOf(source)).toEqual([]);
	});

	test("reports a tag that TSDoc does not define as a warning", () => {
		const source = [
			"/** Runs the task",
			" *",
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

	test("checks the TSDoc of a declaration that is not exported", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @bogus",
			" */",
			"function run(): void {}",
		].join("\n");
		expect(rulesOf(source)).toEqual(["tsdoc-tag"]);
	});

	test("keeps the contract rules off a declaration that is not exported", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @param other - another value",
			" */",
			"function run(value: number): void {}",
		].join("\n");
		expect(rulesOf(source)).toEqual(["param-mismatch"]);
	});

	test("checks the contract of a declaration exported by name", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @param other - another value",
			" */",
			"function run(value: number): void {}",
			"export { run }",
		].join("\n");
		expect(rulesOf(source).sort()).toEqual([
			"param-mismatch",
			"param-untagged",
		]);
	});

	test("checks the contract of the declaration behind export default", () => {
		const source = [
			"/** Reads the value",
			" */",
			"function read(): number {",
			"\treturn 1",
			"}",
			"export default read",
		].join("\n");
		expect(
			scanSource(source, "src/sample.ts", ["missing-returns"]).map(
				(finding) => finding.rule,
			),
		).toEqual(["missing-returns"]);
	});

	test("checks the TSDoc of a class member", () => {
		const source = [
			"/** Runs the task",
			" * and waits",
			" */",
			"export class Runner {",
			"\t/** Runs the member",
			"\t *",
			"\t * @bogus",
			"\t */",
			"\trun(): void {}",
			"}",
		].join("\n");
		expect(rulesOf(source)).toEqual(["tsdoc-tag"]);
	});

	test("checks the contract of a class member under documented", () => {
		const source = [
			"/** Runs the task",
			" * and waits",
			" */",
			"export class Runner {",
			"\t/** Runs the member",
			"\t *",
			"\t * @param other - another value",
			"\t */",
			"\trun(value: number): void {}",
			"}",
		].join("\n");
		expect(
			scanSource(source, "src/sample.ts", [], [], "documented")
				.map((finding) => finding.rule)
				.sort(),
		).toEqual(["param-mismatch", "param-untagged"]);
	});

	test("keeps the contract rules off a class member by default", () => {
		const source = [
			"/** Runs the task",
			" * and waits",
			" */",
			"export class Runner {",
			"\t/** Runs the member",
			"\t *",
			"\t * @param other - another value",
			"\t */",
			"\trun(value: number): void {}",
			"}",
		].join("\n");
		expect(rulesOf(source)).toEqual(["param-mismatch"]);
	});

	test("keeps a single-line doc on a member by default", () => {
		const source = [
			"/** Runs the task",
			" * and waits",
			" */",
			"export class Runner {",
			"\t/** Runs the member */",
			"\trun(): void {}",
			"}",
		].join("\n");
		expect(rulesOf(source)).toEqual([]);
	});

	test("checks a single-line doc on a member under styleScope documented", () => {
		const source = [
			"/** Runs the task",
			" * and waits",
			" */",
			"export class Runner {",
			"\t/** Runs the member */",
			"\trun(): void {}",
			"}",
		].join("\n");
		expect(
			scanSource(source, "src/sample.ts", [], [], "exported", "documented").map(
				(finding) => finding.rule,
			),
		).toEqual(["single-line-doc"]);
	});

	test("keeps a single-line doc off an unexported declaration under styleScope documented", () => {
		const source = "/** Runs the task */\nfunction run(): void {}\n";
		expect(
			scanSource(source, "src/sample.ts", [], [], "exported", "documented").map(
				(finding) => finding.rule,
			),
		).toEqual(["single-line-doc"]);
	});

	test("checks the contract of a documented declaration under documented", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @param other - another value",
			" */",
			"function run(value: number): void {}",
		].join("\n");
		expect(
			scanSource(source, "src/sample.ts", [], [], "documented")
				.map((finding) => finding.rule)
				.sort(),
		).toEqual(["param-mismatch", "param-untagged"]);
	});

	test("keeps missing-doc on the public surface under documented", () => {
		expect(
			scanSource(
				"function run(): void {}\n",
				"src/sample.ts",
				[],
				[],
				"documented",
			),
		).toEqual([]);
	});

	test("requires a comment on every declaration outside a function body under all", () => {
		expect(
			scanSource(
				"function run(): void {}\n",
				"src/sample.ts",
				[],
				[],
				"all",
			).map((finding) => finding.rule),
		).toEqual(["missing-doc"]);
	});

	test("does not require a comment on a declaration inside a function body", () => {
		const source = [
			"/** Reads the value",
			" */",
			"export function read(): void {",
			"\tconst load = (): void => {}",
			"}",
		].join("\n");
		expect(scanSource(source, "src/sample.ts", [], [], "all")).toEqual([]);
	});

	test("skips a file that does not parse", () => {
		expect(rulesOf("export function run( {")).toEqual([]);
	});

	test("drops a finding that a suppression covers", () => {
		const source = [
			"// tsdoc-check-ignore missing-doc: the value is read by the loader",
			"export const value = 1",
		].join("\n");
		expect(rulesOf(source)).toEqual([]);
	});

	test("reports a suppression without a reason", () => {
		const source = [
			"// tsdoc-check-ignore missing-doc",
			"export const value = 1",
		].join("\n");
		expect(rulesOf(source)).toEqual(["suppression"]);
	});

	test("reports a suppression of an unknown rule", () => {
		const source = [
			"// tsdoc-check-ignore missing-docs: a typo",
			"export const value = 1",
		].join("\n");
		expect(rulesOf(source).sort()).toEqual(["missing-doc", "suppression"]);
	});

	test("reports a suppression that covers nothing", () => {
		const source = [
			"// tsdoc-check-ignore tsdoc-tag: kept for the parser",
			"/** Runs the task",
			" *",
			" * @param value - the value",
			" */",
			"export function run(value: number): void {}",
		].join("\n");
		expect(rulesOf(source)).toEqual(["suppression-unused"]);
	});

	test("reads a suppression out of a block comment", () => {
		const source = [
			"/*",
			" * tsdoc-check-ignore missing-doc: declared for the bundle",
			" */",
			"export const value = 1",
		].join("\n");
		expect(rulesOf(source)).toEqual([]);
	});

	test("reports a parameter without a @param tag", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @param other - another value",
			" */",
			"export function run(value: number): void {}",
		].join("\n");
		const findings = scanSource(source, "src/sample.ts");
		expect(rulesOf(source).sort()).toEqual([
			"param-mismatch",
			"param-untagged",
		]);
		const untagged = findings.find(
			(finding) => finding.rule === "param-untagged",
		);
		expect(untagged?.severity).toBe("warning");
		expect(untagged?.message).toContain("value");
	});

	test("reports a type parameter without a @typeParam tag", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @param value - the value",
			" * @typeParam U - the value type",
			" */",
			"export function run<T, U>(value: T): void {}",
		].join("\n");
		expect(rulesOf(source)).toEqual(["type-param-untagged"]);
	});

	test("keeps the parameter order rule off by default", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @param second - the second value",
			" * @param first - the first value",
			" */",
			"export function run(first: number, second: number): void {}",
		].join("\n");
		expect(rulesOf(source)).toEqual([]);
	});

	test("reports @param tags out of the declaration order when enabled", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @param second - the second value",
			" * @param first - the first value",
			" */",
			"export function run(first: number, second: number): void {}",
		].join("\n");
		const findings = scanSource(source, "src/sample.ts", ["param-order"]);
		expect(findings.map((finding) => finding.rule)).toEqual(["param-order"]);
		expect(findings[0]?.severity).toBe("warning");
	});

	test("keeps the returns rule off by default", () => {
		const source = [
			"/** Reads the value",
			" */",
			"export function read(): number {",
			"\treturn 1",
			"}",
		].join("\n");
		expect(rulesOf(source)).toEqual([]);
	});

	test("reports a missing @returns when the function returns a value", () => {
		const source = [
			"/** Reads the value",
			" */",
			"export function read(): number {",
			"\treturn 1",
			"}",
		].join("\n");
		const findings = scanSource(source, "src/sample.ts", ["missing-returns"]);
		expect(findings.map((finding) => finding.rule)).toEqual([
			"missing-returns",
		]);
		expect(findings[0]?.severity).toBe("warning");
	});

	test("accepts @returns when the function returns a value", () => {
		const source = [
			"/** Reads the value",
			" *",
			" * @returns the value",
			" */",
			"export function read(): number {",
			"\treturn 1",
			"}",
		].join("\n");
		expect(scanSource(source, "src/sample.ts", ["missing-returns"])).toEqual(
			[],
		);
	});

	test("does not ask for @returns on a void function", () => {
		const source = [
			"/** Runs the task",
			" */",
			"export function run(): void {}",
			"/** Waits for the task",
			" */",
			"export async function wait(): Promise<void> {}",
		].join("\n");
		expect(scanSource(source, "src/sample.ts", ["missing-returns"])).toEqual(
			[],
		);
	});

	test("does not ask for @returns without a return type annotation", () => {
		const source = [
			"/** Reads the value",
			" */",
			"export function read() {",
			"\treturn 1",
			"}",
		].join("\n");
		expect(scanSource(source, "src/sample.ts", ["missing-returns"])).toEqual(
			[],
		);
	});

	test("drops a new rule finding that a suppression covers", () => {
		const source = [
			"// tsdoc-check-ignore param-untagged: the loader passes the value",
			"/** Runs the task",
			" *",
			" * @param other - another value",
			" */",
			"export function run(value: number): void {}",
		].join("\n");
		expect(rulesOf(source)).toEqual(["param-mismatch"]);
	});

	test("reports an empty @deprecated as a syntax error", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @deprecated",
			" */",
			"export function run(): void {}",
		].join("\n");
		expect(rulesOf(source)).toEqual(["tsdoc-syntax"]);
	});

	test("keeps the deprecation rule off by default", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @deprecated Use runAsync instead",
			" */",
			"export function run(): void {}",
		].join("\n");
		expect(rulesOf(source)).toEqual([]);
	});

	test("reports a @deprecated without a replacement when enabled", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @deprecated Use runAsync instead",
			" */",
			"export function run(): void {}",
		].join("\n");
		const findings = scanSource(source, "src/sample.ts", [
			"deprecated-without-guidance",
		]);
		expect(findings.map((finding) => finding.rule)).toEqual([
			"deprecated-without-guidance",
		]);
		expect(findings[0]?.severity).toBe("warning");
	});

	test("accepts a @deprecated that links to the replacement", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @deprecated Use {@link runAsync} instead",
			" */",
			"export function run(): void {}",
		].join("\n");
		expect(
			scanSource(source, "src/sample.ts", ["deprecated-without-guidance"]),
		).toEqual([]);
	});

	test("accepts a @deprecated next to a @see tag", () => {
		const source = [
			"/** Runs the task",
			" *",
			" * @deprecated Use the async variant",
			" * @see runAsync for the replacement",
			" */",
			"export function run(): void {}",
		].join("\n");
		expect(
			scanSource(source, "src/sample.ts", ["deprecated-without-guidance"]),
		).toEqual([]);
	});
});

describe("object literal members", () => {
	test("checks a single-line doc on a property under styleScope documented", () => {
		const source = [
			"/** Builds the schema",
			" */",
			"export const schema = z.object({",
			"\t/** the value */",
			"\tvalue: z.string(),",
			"})",
		].join("\n");
		expect(
			scanSource(source, "src/sample.ts", [], [], "exported", "documented").map(
				(finding) => finding.rule,
			),
		).toEqual(["single-line-doc"]);
	});

	test("keeps a single-line doc on a property by default", () => {
		const source = [
			"/** Builds the schema",
			" */",
			"export const schema = z.object({",
			"\t/** the value */",
			"\tvalue: z.string(),",
			"})",
		].join("\n");
		expect(scanSource(source, "src/sample.ts")).toEqual([]);
	});

	test("checks a doc on a property nested in another property value", () => {
		const source = [
			"/** Builds the config",
			" */",
			"export const config = {",
			"\t/** the section",
			"\t */",
			"\tsection: {",
			"\t\t/** the value */",
			"\t\tvalue: 1,",
			"\t},",
			"}",
		].join("\n");
		expect(
			scanSource(source, "src/sample.ts", [], [], "exported", "documented").map(
				(finding) => finding.rule,
			),
		).toEqual(["single-line-doc"]);
	});

	test("checks a doc on a property inside an array element and a wrapper", () => {
		const source = [
			"/** Builds the list",
			" */",
			"export const list = [{",
			"\t/** the value */",
			"\tvalue: 1,",
			"}] as const",
		].join("\n");
		expect(
			scanSource(source, "src/sample.ts", [], [], "exported", "documented").map(
				(finding) => finding.rule,
			),
		).toEqual(["single-line-doc"]);
	});

	test("checks the contract of an object method under documented", () => {
		const source = [
			"/** Builds the api",
			" */",
			"export const api = {",
			"\t/** Reads the value",
			"\t *",
			"\t * @param other - another value",
			"\t */",
			"\tread(value: number): number {",
			"\t\treturn value",
			"\t},",
			"}",
		].join("\n");
		expect(
			scanSource(source, "src/sample.ts", [], [], "documented")
				.map((finding) => finding.rule)
				.sort(),
		).toEqual(["param-mismatch", "param-untagged"]);
	});
});

describe("disabled rules", () => {
	test("turns off a rule that is on by default", () => {
		const source = "/** Runs the task */\nexport function run(): void {}\n";
		expect(rulesOf(source)).toEqual(["single-line-doc"]);
		expect(
			scanSource(source, "src/sample.ts", [], ["single-line-doc"]),
		).toEqual([]);
	});
});
