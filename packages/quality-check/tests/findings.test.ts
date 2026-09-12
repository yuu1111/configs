import { describe, expect, test } from "bun:test";
import { parseFindings } from "../src/findings";

describe("engine findings", () => {
	test("reads the added findings of comment-check", () => {
		const parsed = parseFindings(
			"comment-check",
			JSON.stringify({
				added: [
					{
						column: 3,
						file: "src/a.ts",
						line: 2,
						rule: "placeholder-comment",
						text: "TODO: one",
					},
				],
				resolved: [],
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
				text: "TODO: one",
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
