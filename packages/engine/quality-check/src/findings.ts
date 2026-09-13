import type { Located, Severity } from "@yuu1111/shared/findings";
import { type ReportFinding, readReport } from "@yuu1111/shared/report";
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
 * engineが--jsonで返した検出の分類
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
 * engineの--json出力を検出へ変換する 解析できない出力は例外にする
 *
 * @param engine - 出力を解釈するengine名
 * @param stdout - engineが--jsonで出力した文字列
 * @returns 阻害する検出と警告に分けた検出
 */
export function parseFindings(
	engine: EngineName,
	stdout: string,
): ParsedFindings {
	const report = readReport(engine, stdout);
	return {
		errors: report.errors.map((finding) => normalize(engine, finding)),
		warnings: report.warnings.map((finding) => normalize(engine, finding)),
	};
}
