import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { normalizePath } from "@yuu1111/shared/files";
import { compareFindings } from "@yuu1111/shared/findings";
import { extractComments } from "./comments";
import {
	classifyComment,
	type Finding,
	findJapanesePeriod,
	isCrampedComment,
	normalizeComment,
	type OptInRuleId,
} from "./rules";

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
 * source文字列を走査してcomment違反を検出する 既定ではopt-in ruleを実行しない
 *
 * @param source - 走査するsource文字列
 * @param file - 指摘に載せるfileのpath
 * @param enabled - 追加で有効にするopt-in ruleの一覧
 * @returns 検出したcomment違反の一覧
 */
export function scanSource(
	source: string,
	file: string,
	enabled: readonly OptInRuleId[] = [],
): Finding[] {
	const findings: Finding[] = [];
	for (const comment of extractComments(source)) {
		const text = normalizeComment(comment.text);
		const rule = classifyComment(comment.text);
		if (rule !== null) {
			const position = positionAt(source, comment.start);
			findings.push({
				column: position.column,
				file,
				line: position.line,
				rule,
				text,
			});
		}
		if (
			enabled.includes("cramped-comment") &&
			comment.kind === "block" &&
			source.slice(comment.start, comment.end).includes("\n") &&
			isCrampedComment(source, comment.start)
		) {
			const position = positionAt(source, comment.start);
			findings.push({
				column: position.column,
				file,
				line: position.line,
				rule: "cramped-comment",
				text,
			});
		}
		if (!enabled.includes("japanese-period")) {
			continue;
		}
		const offset = findJapanesePeriod(comment.text);
		if (offset < 0) {
			continue;
		}
		const position = positionAt(source, comment.start + 2 + offset);
		findings.push({
			column: position.column,
			file,
			line: position.line,
			rule: "japanese-period",
			text,
		});
	}
	return findings;
}

/**
 * fileを読み込んでcomment違反を検出する
 *
 * @param file - 読み込むfileのpath
 * @param cwd - 指摘に載せる相対pathの基準ディレクトリ
 * @param enabled - 追加で有効にするopt-in ruleの一覧
 * @returns 検出したcomment違反の一覧
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
 * @param enabled - 追加で有効にするopt-in ruleの一覧
 * @returns 位置順に並べたcomment違反の一覧
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
