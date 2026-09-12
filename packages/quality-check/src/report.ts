import { type Painter, plainPainter } from "./color";
import { isFindingEngine } from "./engines";
import type { NormalizedFinding } from "./findings";
import type { EngineResult } from "./run";

function describeFinding(
	finding: NormalizedFinding,
	paint: Painter,
	tone: "error" | "warn",
): string {
	return `${finding.file}:${finding.line}:${finding.column} ${finding.rule} ${paint(finding.severity, tone)} ${finding.text}`;
}

function describeCounts(result: EngineResult): string {
	if (!isFindingEngine(result.name)) {
		return `exit ${result.exitCode}`;
	}
	return `${result.reported.length} new, ${result.resolved} resolved, ${result.warnings.length} warnings`;
}

function describeStatus(result: EngineResult, paint: Painter): string {
	if (result.status === "error") {
		return paint("error", "error");
	}
	const tone = result.status === "passed" ? "pass" : "error";
	return `${paint(result.status, tone)} (${describeCounts(result)})`;
}

/**
 * engine1つ分の出力sectionを組み立てる
 */
export function formatEngineSection(
	result: EngineResult,
	paint: Painter = plainPainter,
): string {
	const lines = [paint(`== ${result.name} ==`, "header")];
	for (const skipped of result.skipped) {
		lines.push(paint(`${result.name}: ${skipped}`, "muted"));
	}
	if (result.output !== "" && !isFindingEngine(result.name)) {
		lines.push(result.output);
	}
	for (const finding of result.reported) {
		lines.push(describeFinding(finding, paint, "error"));
	}
	for (const finding of result.warnings) {
		lines.push(describeFinding(finding, paint, "warn"));
	}
	if (result.message !== undefined) {
		lines.push(paint(result.message, "error"));
	}
	lines.push(`${result.name}: ${describeStatus(result, paint)}`);
	return lines.join("\n");
}

/**
 * 失敗したengineを列挙した集約summaryを組み立てる
 */
export function formatSummary(
	results: EngineResult[],
	paint: Painter = plainPainter,
): string {
	const failed = results
		.filter((result) => result.status !== "passed")
		.map((result) => result.name);
	const passed = results
		.filter((result) => result.status === "passed")
		.map((result) => result.name);
	if (failed.length === 0) {
		return paint(`quality-check: ${results.length} engines passed`, "pass");
	}
	const lines = [
		paint(
			`quality-check: ${failed.length} of ${results.length} engines failed`,
			"error",
		),
		`  ${paint("failed:", "error")} ${failed.join(", ")}`,
	];
	if (passed.length > 0) {
		lines.push(`  ${paint("passed:", "pass")} ${passed.join(", ")}`);
	}
	return lines.join("\n");
}

/**
 * engineの結果をJSONへ変換する
 */
export function toJsonReport(results: EngineResult[]): unknown {
	return {
		engines: results.map((result) => ({
			detected: result.detected.length,
			exitCode: result.exitCode,
			message: result.message ?? null,
			name: result.name,
			reported: result.reported,
			resolved: result.resolved,
			skipped: result.skipped,
			status: result.status,
			warnings: result.warnings,
		})),
		failed: results
			.filter((result) => result.status !== "passed")
			.map((result) => result.name),
	};
}
