import type { Located, Severity } from "@yuu1111/shared/findings";
import type { EngineReport, ReportFinding } from "@yuu1111/shared/report";
import type { EngineName } from "./config";

/**
 * engine間の差を吸収した検出1件
 */
export interface NormalizedFinding extends Located {
	engine: EngineName;
	rule: string;
	severity: Severity;
	text: string;
}

/**
 * engineが返した検出の分類
 */
export interface ParsedFindings {
	errors: NormalizedFinding[];
	warnings: NormalizedFinding[];
}

function normalize(
	engine: EngineName,
	finding: ReportFinding,
): NormalizedFinding {
	return {
		column: finding.column,
		engine,
		file: finding.file,
		line: finding.line,
		rule: finding.rule,
		severity: finding.severity,
		text: finding.message,
	};
}

/**
 * engineが返した報告を検出へ変換する
 *
 * @param engine - 報告を出したengine名
 * @param report - engineが返した報告
 * @returns 阻害する検出と警告に分けた検出
 */
export function normalizeReport(
	engine: EngineName,
	report: EngineReport,
): ParsedFindings {
	return {
		errors: report.errors.map((finding) => normalize(engine, finding)),
		warnings: report.warnings.map((finding) => normalize(engine, finding)),
	};
}
