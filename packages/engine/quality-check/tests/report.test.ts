import { describe, expect, test } from "bun:test";
import { ansiPainter } from "@yuu1111/shared/color";
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
	durationMs: number | null = null,
): EngineResult {
	return {
		detected: [],
		durationMs,
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

	test("adds the engine time to the status line", () => {
		expect(formatEngineSection(result("biome", "passed", [], 74))).toContain(
			"biome: passed (exit 0, 74ms)",
		);
	});

	test("adds the engine time after the counts of a finding engine", () => {
		expect(
			formatEngineSection(result("comment-check", "failed", [], 118)),
		).toContain("comment-check: failed (0 new, 0 resolved, 0 warnings, 118ms)");
	});

	test("adds the engine time to an error status", () => {
		expect(formatEngineSection(result("knip", "error", [], 210))).toContain(
			"knip: error (210ms)",
		);
	});

	test("leaves the time off an engine that never started", () => {
		const section = formatEngineSection(result("biome", "error"));
		expect(section).toContain("biome: error");
		expect(section).not.toContain("ms)");
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
		const summary = formatSummary(
			[
				result("biome", "passed"),
				result("knip", "failed"),
				result("comment-check", "error"),
			],
			4210,
		);
		expect(summary).toContain("2 of 3 engines failed (4210ms)");
		expect(summary).toContain("failed: knip, comment-check");
		expect(summary).toContain("passed: biome");
	});

	test("reports a clean run", () => {
		expect(formatSummary([result("biome", "passed")], 1500)).toBe(
			"quality-check: 1 engines passed (1500ms)",
		);
	});

	test("rounds the elapsed time to whole milliseconds", () => {
		expect(formatSummary([result("biome", "passed")], 12.6)).toBe(
			"quality-check: 1 engines passed (13ms)",
		);
	});

	test("paints the state of the engine", () => {
		const section = formatEngineSection(
			result("biome", "passed"),
			ansiPainter(),
		);
		expect(section).toContain("\u001b[36m== biome ==\u001b[0m");
		expect(section).toContain("\u001b[32mpassed\u001b[0m");
	});

	test("paints a warning apart from an error", () => {
		const engine = result("comment-check", "failed");
		engine.warnings = [
			{
				column: 1,
				engine: "comment-check",
				file: "src/a.ts",
				line: 1,
				rule: "placeholder-comment",
				severity: "warning",
				text: "later",
			},
		];
		const section = formatEngineSection(engine, ansiPainter());
		expect(section).toContain("\u001b[33mwarning\u001b[0m");
	});

	test("paints the failed summary", () => {
		const summary = formatSummary(
			[result("biome", "failed")],
			4210,
			ansiPainter(),
		);
		expect(summary).toContain("\u001b[31m");
	});

	test("reports the failed engines as JSON", () => {
		const report = toJsonReport(
			[result("biome", "passed", [], 74), result("knip", "failed", [], 210.4)],
			4210,
		) as {
			elapsedMs: number;
			engines: { durationMs: number | null }[];
			failed: string[];
		};
		expect(report.failed).toEqual(["knip"]);
		expect(report.elapsedMs).toBe(4210);
		expect(report.engines.map((engine) => engine.durationMs)).toEqual([
			74, 210,
		]);
	});

	test("reports no duration for an engine that never started as JSON", () => {
		const report = toJsonReport([result("biome", "error")], 4210) as {
			engines: { durationMs: number | null }[];
		};
		expect(report.engines[0]?.durationMs).toBeNull();
	});
});
