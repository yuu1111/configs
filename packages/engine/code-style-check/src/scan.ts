import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { normalizePath } from "@yuu1111/shared/files";
import { compareFindings } from "@yuu1111/shared/findings";
import { collectAdjacentDefinitions, type DefinitionPair } from "./parse";
import { classifyGap, countBlankLines, type Finding } from "./rules";

/**
 * code-style-checkが検査する拡張子
 */
export const SUPPORTED_EXTENSIONS: ReadonlySet<string> = new Set([
	".cjs",
	".cts",
	".js",
	".jsx",
	".mjs",
	".mts",
	".ts",
	".tsx",
]);

function definitionsOf(source: string, file: string): DefinitionPair[] {
	try {
		return collectAdjacentDefinitions(source, file);
	} catch {
		// 構文エラーはBiomeとtscが担当するため、解析できないfileは対象外にする
		return [];
	}
}

/**
 * source文字列の関数定義の間隔を検査する
 *
 * @param source - 関数定義の間隔を検査するsource文字列
 * @param file - 指摘に載せるfileのpath
 * @returns 検出した関数定義の間隔の違反
 */
export function scanSource(source: string, file: string): Finding[] {
	const findings: Finding[] = [];
	for (const pair of definitionsOf(source, file)) {
		const blankLines = countBlankLines(
			source,
			pair.previous.end,
			pair.next.start,
		);
		const classification = classifyGap(blankLines, pair.next.name);
		if (classification === null) {
			continue;
		}
		findings.push({
			column: pair.next.column,
			file,
			line: pair.next.line,
			message: classification.message,
			rule: "blank-line-between-functions",
			severity: classification.severity,
		});
	}
	return findings;
}

/**
 * fileを読み込んで関数定義の間隔を検査する
 *
 * @param file - 読み込んで検査するfileのpath
 * @param cwd - 指摘に載せる相対pathの基準directory
 * @returns 検出した関数定義の間隔の違反
 */
export function scanFile(file: string, cwd = process.cwd()): Finding[] {
	return scanSource(
		readFileSync(file, "utf8"),
		normalizePath(relative(cwd, file)),
	);
}

/**
 * 複数fileの違反をまとめて位置順に並べる
 *
 * @param files - 検査するfileのpath一覧
 * @param cwd - 指摘に載せる相対pathの基準directory
 * @returns 位置順に並べた関数定義の間隔の違反
 */
export function scanFiles(files: string[], cwd = process.cwd()): Finding[] {
	const findings: Finding[] = [];
	for (const file of files) {
		findings.push(...scanFile(file, cwd));
	}
	return findings.sort(compareFindings);
}
