import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { normalizePath } from "@yuu1111/shared/files";
import { compareFindings } from "@yuu1111/shared/findings";
import { collectDeclarations } from "./parse";
import type { OptInRuleId } from "./rule-ids";
import { classifyDeclaration, type Finding } from "./rules";

/**
 * 検査するTypeScriptの拡張子
 */
export const TYPESCRIPT_EXTENSIONS: ReadonlySet<string> = new Set([
	".cts",
	".mts",
	".ts",
	".tsx",
]);

/**
 * source文字列の宣言を解析してTSDoc違反を検出する
 *
 * @param source - 解析するsource文字列
 * @param file - 指摘に載せるfileのpath
 * @param enabled - 実行するopt-in ruleの識別子一覧
 * @returns 検出したTSDoc違反
 */
export function scanSource(
	source: string,
	file: string,
	enabled: readonly OptInRuleId[] = [],
): Finding[] {
	try {
		return collectDeclarations(source, file).flatMap((declaration) =>
			classifyDeclaration(declaration, file, source, enabled),
		);
	} catch {
		// 構文エラーはtscとBiomeが担当するため、解析できないfileは対象外にする
		return [];
	}
}

/**
 * fileを読み込んでTSDoc違反を検出する
 *
 * @param file - 読み込むfileのpath
 * @param cwd - 指摘に載せる相対pathの基準ディレクトリ
 * @param enabled - 実行するopt-in ruleの識別子一覧
 * @returns 検出したTSDoc違反
 */
export function scanFile(
	file: string,
	cwd = process.cwd(),
	enabled: readonly OptInRuleId[] = [],
): Finding[] {
	return scanSource(
		readFileSync(file, "utf8"),
		normalizePath(relative(cwd, file)),
		enabled,
	);
}

/**
 * 複数fileの違反をまとめて位置順に並べる
 *
 * @param files - 検査するfileのpath一覧
 * @param cwd - 指摘に載せる相対pathの基準ディレクトリ
 * @param enabled - 実行するopt-in ruleの識別子一覧
 * @returns 位置順に並べたTSDoc違反
 */
export function scanFiles(
	files: string[],
	cwd = process.cwd(),
	enabled: readonly OptInRuleId[] = [],
): Finding[] {
	const findings: Finding[] = [];
	for (const file of files) {
		findings.push(...scanFile(file, cwd, enabled));
	}
	return findings.sort(compareFindings);
}
