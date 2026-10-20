import { formatLocation, type Located, type Severity } from "./findings";
import { isJsonObject } from "./json";

/**
 * engineが`--json`で返す検出1件
 */
export interface ReportFinding extends Located {
	message: string;
	rule: string;
	severity: Severity;
}

/**
 * engineが`--json`で返す検出の組
 */
export interface EngineReport {
	errors: ReportFinding[];
	warnings: ReportFinding[];
}

/**
 * 検出を重大度ごとに分けた報告へ変換する 並び順は渡された順を保つ
 *
 * @param findings - 報告へ分ける検出の一覧
 * @returns errorとwarningに分けた報告
 */
export function toReport(findings: readonly ReportFinding[]): EngineReport {
	return {
		errors: findings.filter((finding) => finding.severity === "error"),
		warnings: findings.filter((finding) => finding.severity === "warning"),
	};
}

/**
 * 検出1件を1行のtextへ整える
 *
 * @param finding - 1行へ整える検出
 * @returns file:line:columnとruleとseverityとmessageを並べた1行
 */
export function describeReportFinding(finding: ReportFinding): string {
	return `${formatLocation(finding)} ${finding.rule} ${finding.severity} ${finding.message}`;
}

/**
 * 検査したfile数と検出数をまとめた1行を返す
 *
 * @param fileCount - 検査したfile数
 * @param report - 件数を数える報告
 * @returns 検査数とerror数とwarning数を並べた1行
 */
export function formatReportSummary(
	fileCount: number,
	report: EngineReport,
): string {
	return `Checked ${fileCount} files: ${report.errors.length} errors, ${report.warnings.length} warnings`;
}

/**
 * 報告をengineの出力形式へ直列化する
 *
 * @param report - 直列化する報告
 * @returns タブ区切りのJSON text
 */
export function serializeReport(report: EngineReport): string {
	return JSON.stringify(report, null, "\t");
}

/**
 * 報告をengineの出力形式で標準出力へ書き出す
 *
 * @param report - 書き出す報告
 */
export function printReport(report: EngineReport): void {
	console.log(serializeReport(report));
}

function readFinding(
	engine: string,
	value: unknown,
	severity: Severity,
): ReportFinding {
	if (!isJsonObject(value)) {
		throw new Error(`${engine} printed an unexpected finding`);
	}
	const { column, file, line, message, rule } = value;
	if (
		typeof rule !== "string" ||
		typeof file !== "string" ||
		typeof line !== "number" ||
		typeof column !== "number" ||
		typeof message !== "string"
	) {
		throw new Error(`${engine} printed an unexpected finding`);
	}
	return { column, file, line, message, rule, severity };
}

function readEntries(engine: string, value: unknown, field: string): unknown[] {
	if (!Array.isArray(value)) {
		throw new Error(`${engine} printed JSON without a ${field} array`);
	}
	return value;
}

/**
 * engineの`--json`出力を報告として読み取る
 *
 * @param engine - 出力を解釈するengine名 エラーmessageへ載せる
 * @param stdout - engineが`--json`で出力したtext
 * @returns errorとwarningに分けた報告
 */
export function readReport(engine: string, stdout: string): EngineReport {
	let value: unknown;
	try {
		value = JSON.parse(stdout);
	} catch (error) {
		throw new Error(`${engine} did not print JSON`, { cause: error });
	}
	if (!isJsonObject(value)) {
		throw new Error(`${engine} printed an unexpected JSON value`);
	}
	return {
		errors: readEntries(engine, value.errors, "errors").map((entry) =>
			readFinding(engine, entry, "error"),
		),
		warnings: readEntries(engine, value.warnings, "warnings").map((entry) =>
			readFinding(engine, entry, "warning"),
		),
	};
}
