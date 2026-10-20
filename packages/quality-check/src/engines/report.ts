import { isJsonObject } from "../utils/json";
import type { Located, Severity } from "./findings";

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
