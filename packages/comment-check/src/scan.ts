import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { normalizePath } from "@yuu1111/shared/files";
import { compareFindings } from "@yuu1111/shared/findings";
import { extractComments } from "./comments";
import { classifyComment, type Finding, normalizeComment } from "./rules";

/**
 * commentを検査する拡張子
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

function positionAt(
	source: string,
	offset: number,
): { line: number; column: number } {
	let line = 1;
	let lineStart = 0;
	for (let index = 0; index < offset; index += 1) {
		if (source[index] === "\n") {
			line += 1;
			lineStart = index + 1;
		}
	}
	return { line, column: offset - lineStart + 1 };
}

/**
 * source文字列を走査してcomment違反を検出する
 */
export function scanSource(source: string, file: string): Finding[] {
	const findings: Finding[] = [];
	for (const comment of extractComments(source)) {
		const rule = classifyComment(comment.text);
		if (rule === null) {
			continue;
		}
		const position = positionAt(source, comment.start);
		findings.push({
			column: position.column,
			file,
			line: position.line,
			rule,
			text: normalizeComment(comment.text),
		});
	}
	return findings;
}

/**
 * fileを読み込んでcomment違反を検出する
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
