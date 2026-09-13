import { describe, expect, test } from "bun:test";
import { parseFindings } from "../src/findings";

describe("engine findings", () => {
	test("reads the findings of comment-check", () => {
		const parsed = parseFindings(
			"comment-check",
			JSON.stringify({
				errors: [
					{
						column: 3,
						file: "src/a.ts",
						line: 2,
						message: "placeholder comment should be resolved or tracked",
						rule: "placeholder-comment",
						severity: "error",
					},
				],
				warnings: [],
			}),
		);
		expect(parsed.errors).toEqual([
			{
				column: 3,
				engine: "comment-check",
				file: "src/a.ts",
				line: 2,
				rule: "placeholder-comment",
				severity: "error",
				text: "placeholder comment should be resolved or tracked",
			},
		]);
		expect(parsed.warnings).toEqual([]);
	});

	test("separates the errors and warnings of tsdoc-check", () => {
		const parsed = parseFindings(
			"tsdoc-check",
			JSON.stringify({
				errors: [
					{
						column: 1,
						file: "src/b.ts",
						line: 4,
						message: "syntax error",
						rule: "tsdoc-syntax",
						severity: "error",
					},
				],
				warnings: [
					{
						column: 2,
						file: "src/b.ts",
						line: 9,
						message: "no comment",
						rule: "missing-doc",
						severity: "warning",
					},
				],
			}),
		);
		expect(parsed.errors.map((finding) => finding.rule)).toEqual([
			"tsdoc-syntax",
		]);
		expect(parsed.warnings.map((finding) => finding.rule)).toEqual([
			"missing-doc",
		]);
	});

	test("separates the errors and warnings of document-style-check", () => {
		const parsed = parseFindings(
			"document-style-check",
			JSON.stringify({
				errors: [
					{
						column: 12,
						file: "README.md",
						line: 18,
						message: "an HTML hard break adds spacing without meaning",
						rule: "hard-break-html",
						severity: "error",
					},
				],
				warnings: [],
			}),
		);
		expect(parsed.errors.map((finding) => finding.rule)).toEqual([
			"hard-break-html",
		]);
		expect(parsed.errors[0]?.engine).toBe("document-style-check");
	});

	test("separates the errors and warnings of code-style-check", () => {
		const parsed = parseFindings(
			"code-style-check",
			JSON.stringify({
				errors: [
					{
						column: 1,
						file: "src/c.ts",
						line: 5,
						message:
							"the function definition save needs a single blank line before it",
						rule: "blank-line-between-definitions",
						severity: "error",
					},
				],
				warnings: [
					{
						column: 1,
						file: "src/c.ts",
						line: 12,
						message:
							"the function definition load has more than one blank line before it",
						rule: "blank-line-between-definitions",
						severity: "warning",
					},
				],
			}),
		);
		expect(parsed.errors.map((finding) => finding.severity)).toEqual(["error"]);
		expect(parsed.warnings.map((finding) => finding.severity)).toEqual([
			"warning",
		]);
		expect(parsed.errors[0]?.engine).toBe("code-style-check");
	});

	test("rejects output that is not JSON", () => {
		expect(() => parseFindings("comment-check", "not json")).toThrow(
			"did not print JSON",
		);
	});

	test("rejects a missing finding array", () => {
		expect(() =>
			parseFindings("tsdoc-check", JSON.stringify({ errors: [] })),
		).toThrow("without a warnings array");
	});
});
