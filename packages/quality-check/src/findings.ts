import type { Located, Severity } from "@yuu1111/shared/findings";
import { isJsonObject } from "@yuu1111/shared/json";
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

function readFinding(
	engine: EngineName,
	value: unknown,
	severity: Severity,
	textField: "message" | "text",
): NormalizedFinding {
	if (!isJsonObject(value)) {
		throw new Error(`${engine} printed an unexpected finding`);
	}
	const { column, file, line, rule } = value;
	const text = value[textField];
	if (
		typeof rule !== "string" ||
		typeof file !== "string" ||
		typeof line !== "number" ||
		typeof column !== "number" ||
		typeof text !== "string"
	) {
		throw new Error(`${engine} printed an unexpected finding`);
	}
	return { column, engine, file, line, rule, severity, text };
}

function readEntries(
	engine: EngineName,
	value: unknown,
	field: string,
): unknown[] {
	if (!Array.isArray(value)) {
		throw new Error(`${engine} printed JSON without a ${field} array`);
	}
	return value;
}

function parseJson(
	engine: EngineName,
	stdout: string,
): Record<string, unknown> {
	let value: unknown;
	try {
		value = JSON.parse(stdout);
	} catch {
		throw new Error(`${engine} did not print JSON`);
	}
	if (!isJsonObject(value)) {
		throw new Error(`${engine} printed an unexpected JSON value`);
	}
	return value;
}

/**
 * engineの--json出力を検出へ変換する 解析できない出力は例外にする
 */
export function parseFindings(
	engine: EngineName,
	stdout: string,
): ParsedFindings {
	const value = parseJson(engine, stdout);
	if (engine === "comment-check") {
		return {
			errors: readEntries(engine, value.added, "added").map((entry) =>
				readFinding(engine, entry, "error", "text"),
			),
			warnings: [],
		};
	}
	return {
		errors: readEntries(engine, value.errors, "errors").map((entry) =>
			readFinding(engine, entry, "error", "message"),
		),
		warnings: readEntries(engine, value.warnings, "warnings").map((entry) =>
			readFinding(engine, entry, "warning", "message"),
		),
	};
}
