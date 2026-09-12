import { describe, expect, test } from "bun:test";
import {
	formatEngineSection,
	formatSummary,
	toJsonReport,
} from "../src/report";
import type { EngineResult } from "../src/run";

function result(
	name: EngineResult["name"],
	status: EngineResult["status"],
	skipped: string[] = [],
): EngineResult {
	return {
		detected: [],
		exitCode: status === "passed" ? 0 : 1,
		name,
		output: "",
		reported: [],
		resolved: 0,
		skipped,
		status,
		warnings: [],
	};
}

describe("quality report", () => {
	test("names the engine in its own section", () => {
		const section = formatEngineSection(result("knip", "failed"));
		expect(section).toContain("== knip ==");
		expect(section).toContain("knip: failed (exit 1)");
	});

	test("reports a condition that the engine did not take", () => {
		const section = formatEngineSection(
			result("biome", "passed", [
				"ignore skipped (biome.json holds its settings)",
			]),
		);
		expect(section).toContain(
			"biome: ignore skipped (biome.json holds its settings)",
		);
	});

	test("lists the failed and passed engines", () => {
		const summary = formatSummary([
			result("biome", "passed"),
			result("knip", "failed"),
			result("comment-check", "error"),
		]);
		expect(summary).toContain("2 of 3 engines failed");
		expect(summary).toContain("failed: knip, comment-check");
		expect(summary).toContain("passed: biome");
	});

	test("reports a clean run", () => {
		expect(formatSummary([result("biome", "passed")])).toBe(
			"quality-check: 1 engines passed",
		);
	});

	test("reports the failed engines as JSON", () => {
		const report = toJsonReport([
			result("biome", "passed"),
			result("knip", "failed"),
		]) as { failed: string[] };
		expect(report.failed).toEqual(["knip"]);
	});
});
