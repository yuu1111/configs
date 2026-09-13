import { describe, expect, test } from "bun:test";
import {
	describeReportFinding,
	formatReportSummary,
	readReport,
	serializeReport,
	toReport,
} from "../src/report";

const error = {
	column: 2,
	file: "src/a.ts",
	line: 3,
	message: "placeholder comment should be resolved",
	rule: "placeholder-comment",
	severity: "error",
} as const;

const warning = {
	column: 5,
	file: "src/b.ts",
	line: 9,
	message: "the heading skips a level",
	rule: "heading-level-jump",
	severity: "warning",
} as const;

describe("engine report", () => {
	test("splits findings by severity and keeps the order", () => {
		const report = toReport([warning, error, warning]);
		expect(report.errors).toEqual([error]);
		expect(report.warnings).toEqual([warning, warning]);
	});

	test("formats one finding into a single line", () => {
		expect(describeReportFinding(error)).toBe(
			"src/a.ts:3:2 placeholder-comment error placeholder comment should be resolved",
		);
	});

	test("summarizes the checked files and the counts", () => {
		expect(formatReportSummary(42, toReport([error, warning]))).toBe(
			"Checked 42 files: 1 errors, 1 warnings",
		);
	});

	test("reads back what it serialized", () => {
		const report = toReport([error, warning]);
		expect(readReport("code-style-check", serializeReport(report))).toEqual(
			report,
		);
	});

	test("rejects output that is not JSON", () => {
		expect(() => readReport("tsdoc-check", "not json")).toThrow(
			"tsdoc-check did not print JSON",
		);
	});

	test("rejects output without a warnings array", () => {
		expect(() =>
			readReport("tsdoc-check", JSON.stringify({ errors: [] })),
		).toThrow("without a warnings array");
	});

	test("rejects a finding that misses a field", () => {
		expect(() =>
			readReport(
				"tsdoc-check",
				JSON.stringify({
					errors: [{ column: 1, file: "a.ts", line: 1 }],
					warnings: [],
				}),
			),
		).toThrow("unexpected finding");
	});
});
