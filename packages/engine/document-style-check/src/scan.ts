import { readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { normalizePath } from "@yuu1111/shared/files";
import { compareFindings } from "@yuu1111/shared/findings";
import { type Finding, fixSource, lintSource, type OptInRuleId } from "./rules";

/**
 * 検査するMarkdownの拡張子
 */
export const DOCUMENT_EXTENSIONS: ReadonlySet<string> = new Set([
	".markdown",
	".md",
]);

/**
 * fileを読み込んで違反を検出する
 */
export function lintFile(
	file: string,
	cwd = process.cwd(),
	enabled: readonly OptInRuleId[] = [],
): Finding[] {
	return lintSource(
		readFileSync(file, "utf8"),
		normalizePath(relative(cwd, file)),
		enabled,
	);
}

/**
 * 複数fileの違反をまとめて位置順に並べる
 */
export function lintFiles(
	files: string[],
	cwd = process.cwd(),
	enabled: readonly OptInRuleId[] = [],
): Finding[] {
	const findings: Finding[] = [];
	for (const file of files) {
		findings.push(...lintFile(file, cwd, enabled));
	}
	return findings.sort(compareFindings);
}

/**
 * fileを整形し、writeした場合だけtrueを返す
 */
export function fixFile(file: string): boolean {
	const source = readFileSync(file, "utf8");
	const fixed = fixSource(source);
	if (fixed === source) {
		return false;
	}
	writeFileSync(file, fixed, "utf8");
	return true;
}

/**
 * 複数fileを整形し、writeしたfile一覧を返す
 */
export function fixFiles(files: string[]): string[] {
	return files.filter((file) => fixFile(file));
}
