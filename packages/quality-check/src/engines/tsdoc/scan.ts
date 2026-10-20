import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { normalizePath } from "../../shared/files";
import { compareFindings } from "../../shared/findings";
import { collectSource } from "./parse";
import {
	FILE_EXTENSIONS,
	type OptInRuleId,
	type RuleId,
	type RuleScopes,
} from "./rule-ids";
import { classifyDeclaration, type Finding, orphanFinding } from "./rules";

/**
 * 検査するTypeScriptの拡張子
 */
export const TYPESCRIPT_EXTENSIONS: ReadonlySet<string> = new Set(
	FILE_EXTENSIONS,
);

/**
 * source文字列の宣言を解析してTSDoc違反を検出する
 *
 * @param source - 解析するsource文字列
 * @param file - 指摘に載せるfileのpath
 * @param enabled - 実行するopt-in ruleの識別子一覧
 * @param disabled - 追加で無効にするruleの一覧
 * @param scopes - ruleごとの検査する宣言の広さ
 * @returns 検出したTSDoc違反
 */
export function scanSource(
	source: string,
	file: string,
	enabled: readonly OptInRuleId[] = [],
	disabled: readonly RuleId[] = [],
	scopes: RuleScopes = {},
): Finding[] {
	try {
		const { declarations, orphans } = collectSource(source, file);
		return [
			...declarations.flatMap((declaration) =>
				classifyDeclaration(declaration, file, source, enabled, scopes),
			),
			...orphans.map((comment) => orphanFinding(comment, file)),
		].filter((finding) => !disabled.includes(finding.rule));
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
 * @param disabled - 追加で無効にするruleの一覧
 * @param scopes - ruleごとの検査する宣言の広さ
 * @returns 検出したTSDoc違反
 */
export function scanFile(
	file: string,
	cwd = process.cwd(),
	enabled: readonly OptInRuleId[] = [],
	disabled: readonly RuleId[] = [],
	scopes: RuleScopes = {},
): Finding[] {
	return scanSource(
		readFileSync(file, "utf8"),
		normalizePath(relative(cwd, file)),
		enabled,
		disabled,
		scopes,
	);
}

/**
 * 複数fileの違反をまとめて位置順に並べる
 *
 * @param files - 検査するfileのpath一覧
 * @param cwd - 指摘に載せる相対pathの基準ディレクトリ
 * @param enabled - 実行するopt-in ruleの識別子一覧
 * @param disabled - 追加で無効にするruleの一覧
 * @param scopes - ruleごとの検査する宣言の広さ
 * @returns 位置順に並べたTSDoc違反
 */
export function scanFiles(
	files: string[],
	cwd = process.cwd(),
	enabled: readonly OptInRuleId[] = [],
	disabled: readonly RuleId[] = [],
	scopes: RuleScopes = {},
): Finding[] {
	const findings: Finding[] = [];
	for (const file of files) {
		findings.push(...scanFile(file, cwd, enabled, disabled, scopes));
	}
	return findings.sort(compareFindings);
}
