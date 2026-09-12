import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { normalizePath } from "@yuu1111/shared/files";
import { compareFindings } from "@yuu1111/shared/findings";
import { collectDeclarations } from "./parse";
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
 */
export function scanSource(source: string, file: string): Finding[] {
	try {
		return collectDeclarations(source, file).flatMap((declaration) =>
			classifyDeclaration(declaration, file, source),
		);
	} catch {
		// 構文エラーはtscとBiomeが担当するため、解析できないfileは対象外にする
		return [];
	}
}

/**
 * fileを読み込んでTSDoc違反を検出する
 */
export function scanFile(file: string, cwd = process.cwd()): Finding[] {
	return scanSource(
		readFileSync(file, "utf8"),
		normalizePath(relative(cwd, file)),
	);
}

/**
 * 複数fileの違反をまとめて位置順に並べる
 */
export function scanFiles(files: string[], cwd = process.cwd()): Finding[] {
	const findings: Finding[] = [];
	for (const file of files) {
		findings.push(...scanFile(file, cwd));
	}
	return findings.sort(compareFindings);
}
