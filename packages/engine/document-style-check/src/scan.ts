import { readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { normalizePath } from "@yuu1111/shared/files";
import { compareFindings } from "@yuu1111/shared/findings";
import type { OptInRuleId, RuleId } from "./rule-ids";
import { type Finding, fixSource, lintSource } from "./rules";

/**
 * 検査するMarkdownの拡張子
 */
export const DOCUMENT_EXTENSIONS: ReadonlySet<string> = new Set([
	".markdown",
	".md",
]);

/**
 * fileを読み込んで違反を検出する
 *
 * @param file - 読み込むMarkdownのpath
 * @param cwd - 指摘に載せる相対pathの基準directory
 * @param enabled - 追加で有効にするopt-in ruleの識別子
 * @param disabled - 追加で無効にするruleの一覧
 * @returns 検出した違反の一覧
 */
export function lintFile(
	file: string,
	cwd = process.cwd(),
	enabled: readonly OptInRuleId[] = [],
	disabled: readonly RuleId[] = [],
): Finding[] {
	return lintSource(
		readFileSync(file, "utf8"),
		normalizePath(relative(cwd, file)),
		enabled,
		disabled,
	);
}

/**
 * 複数fileの違反をまとめて位置順に並べる
 *
 * @param files - 検査するMarkdownのpath一覧
 * @param cwd - 指摘に載せる相対pathの基準directory
 * @param enabled - 追加で有効にするopt-in ruleの識別子
 * @param disabled - 追加で無効にするruleの一覧
 * @returns 位置順に並べた違反の一覧
 */
export function lintFiles(
	files: string[],
	cwd = process.cwd(),
	enabled: readonly OptInRuleId[] = [],
	disabled: readonly RuleId[] = [],
): Finding[] {
	const findings: Finding[] = [];
	for (const file of files) {
		findings.push(...lintFile(file, cwd, enabled, disabled));
	}
	return findings.sort(compareFindings);
}

/**
 * fileを整形し、writeした場合だけtrueを返す
 *
 * @param file - 整形するMarkdownのpath
 * @param enabled - 整形に加えて適用するopt-in ruleの識別子
 * @param disabled - 追加で無効にするruleの一覧
 * @returns 内容をwriteした場合はtrue 変化が無ければfalse
 */
export function fixFile(
	file: string,
	enabled: readonly OptInRuleId[] = [],
	disabled: readonly RuleId[] = [],
): boolean {
	const source = readFileSync(file, "utf8");
	const fixed = fixSource(source, enabled, disabled);
	if (fixed === source) {
		return false;
	}
	writeFileSync(file, fixed, "utf8");
	return true;
}

/**
 * 複数fileを整形し、writeしたfile一覧を返す
 *
 * @param files - 整形するMarkdownのpath一覧
 * @param enabled - 整形に加えて適用するopt-in ruleの識別子
 * @param disabled - 追加で無効にするruleの一覧
 * @returns 実際にwriteしたfileのpath一覧
 */
export function fixFiles(
	files: string[],
	enabled: readonly OptInRuleId[] = [],
	disabled: readonly RuleId[] = [],
): string[] {
	return files.filter((file) => fixFile(file, enabled, disabled));
}
