import { describe, expect, test } from "bun:test";
import { normalizeReport } from "../src/findings";

describe("engine findings", () => {
	test("names the engine and turns a message into text", () => {
		const parsed = normalizeReport("comment-check", {
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
		});
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

	test("separates the errors and the warnings", () => {
		const parsed = normalizeReport("tsdoc-check", {
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
		});
		expect(parsed.errors.map((finding) => finding.rule)).toEqual([
			"tsdoc-syntax",
		]);
		expect(parsed.warnings.map((finding) => finding.rule)).toEqual([
			"missing-doc",
		]);
		expect(parsed.warnings[0]?.engine).toBe("tsdoc-check");
	});
});
