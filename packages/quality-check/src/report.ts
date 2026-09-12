import { isFindingEngine } from "./engines";
import type { NormalizedFinding } from "./findings";
import type { EngineResult } from "./run";

function describeFinding(finding: NormalizedFinding): string {
	return `${finding.file}:${finding.line}:${finding.column} ${finding.rule} ${finding.severity} ${finding.text}`;
}

function describeCounts(result: EngineResult): string {
	if (!isFindingEngine(result.name)) {
		return `exit ${result.exitCode}`;
	}
	return `${result.reported.length} new, ${result.resolved} resolved, ${result.warnings.length} warnings`;
}

function describeStatus(result: EngineResult): string {
	if (result.status === "error") {
		return "error";
	}
	return `${result.status} (${describeCounts(result)})`;
}

/**
 * engine1つ分の出力sectionを組み立てる
 */
export function formatEngineSection(result: EngineResult): string {
	const lines = [`== ${result.name} ==`];
	for (const skipped of result.skipped) {
		lines.push(`${result.name}: ${skipped}`);
	}
	if (result.output !== "" && !isFindingEngine(result.name)) {
		lines.push(result.output);
	}
	for (const finding of [...result.reported, ...result.warnings]) {
		lines.push(describeFinding(finding));
	}
	if (result.message !== undefined) {
		lines.push(result.message);
	}
	lines.push(`${result.name}: ${describeStatus(result)}`);
	return lines.join("\n");
}

/**
 * 失敗したengineを列挙した集約summaryを組み立てる
 */
export function formatSummary(results: EngineResult[]): string {
	const failed = results
		.filter((result) => result.status !== "passed")
		.map((result) => result.name);
	const passed = results
		.filter((result) => result.status === "passed")
		.map((result) => result.name);
	if (failed.length === 0) {
		return `quality-check: ${results.length} engines passed`;
	}
	const lines = [
		`quality-check: ${failed.length} of ${results.length} engines failed`,
		`  failed: ${failed.join(", ")}`,
	];
	if (passed.length > 0) {
		lines.push(`  passed: ${passed.join(", ")}`);
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
