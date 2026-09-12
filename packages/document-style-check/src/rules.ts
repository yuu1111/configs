import { type MarkdownLine, markdownLines } from "./audit";

/**
 * document-style-checkが報告するruleの識別子一覧
 */
export const RULE_IDS = [
	"consecutive-blank-lines",
	"date-anchored-statement",
	"hard-break-html",
	"trailing-backslash",
	"trailing-whitespace",
] as const;

/**
 * RULE_IDSが定義するrule識別子のunion型
 */
export type RuleId = (typeof RULE_IDS)[number];

/**
 * 指摘の重大度
 */
export type Severity = "error" | "warning";

/**
 * 検出した違反1件の内容と位置
 */
export interface Finding {
	column: number;
	file: string;
	line: number;
	message: string;
	rule: RuleId;
	severity: Severity;
}

const MESSAGES: Record<RuleId, string> = {
	"consecutive-blank-lines":
		"consecutive blank lines add spacing without meaning",
	"date-anchored-statement": "a check date is not the identity of the subject",
	"hard-break-html": "an HTML hard break adds spacing without meaning",
	"trailing-backslash": "a trailing backslash adds spacing without meaning",
	"trailing-whitespace": "trailing whitespace is not part of the content",
};

const INLINE_CODE = /`+[^`]*`+/g;
const HARD_BREAK = /<br\s*\/?>/gi;
const DATE_ANCHOR =
	/\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s*に)?(?:確認|時点|現在|版)|(?:確認|執筆|作成)(?:した)?時点/;

/**
 * 指定した位置の違反を組み立てる
 */
function finding(
	rule: RuleId,
	severity: Severity,
	file: string,
	line: number,
	column: number,
): Finding {
	return { column, file, line, message: MESSAGES[rule], rule, severity };
}

/**
 * インラインコードを同じ長さの空白へ置き換え、位置を保つ
 */
function maskInlineCode(line: string): string {
	return line.replace(INLINE_CODE, (span) => " ".repeat(span.length));
}

/**
 * インラインコードの外側だけを置換する
 */
function replaceOutsideInlineCode(
	line: string,
	pattern: RegExp,
	replacement: string,
): string {
	const spans: [number, number][] = [];
	for (const match of line.matchAll(INLINE_CODE)) {
		const start = match.index;
		spans.push([start, start + match[0].length]);
	}
	if (spans.length === 0) {
		return line.replace(pattern, replacement);
	}
	let result = "";
	let cursor = 0;
	for (const [start, end] of spans) {
		result +=
			line.slice(cursor, start).replace(pattern, replacement) +
			line.slice(start, end);
		cursor = end;
	}
	return result + line.slice(cursor).replace(pattern, replacement);
}

/**
 * 通常本文の1行から、位置で示せる違反を検出する
 */
function lintBodyLine(item: MarkdownLine, file: string): Finding[] {
	const findings: Finding[] = [];
	const trailing = item.line.length - item.line.trimEnd().length;
	if (trailing > 0) {
		findings.push(
			finding(
				"trailing-whitespace",
				"error",
				file,
				item.number,
				item.line.length - trailing + 1,
			),
		);
	}
	const masked = maskInlineCode(item.line);
	const hardBreak = masked.search(HARD_BREAK);
	if (hardBreak >= 0) {
		findings.push(
			finding("hard-break-html", "error", file, item.number, hardBreak + 1),
		);
	}
	if (!item.structural && masked.trimEnd().endsWith("\\")) {
		findings.push(
			finding(
				"trailing-backslash",
				"error",
				file,
				item.number,
				masked.trimEnd().length,
			),
		);
	}
	const anchor = masked.search(DATE_ANCHOR);
	if (anchor >= 0) {
		findings.push(
			finding(
				"date-anchored-statement",
				"warning",
				file,
				item.number,
				anchor + 1,
			),
		);
	}
	return findings;
}

/**
 * 本文文字列を検査して違反を検出する
 */
export function lintSource(source: string, file: string): Finding[] {
	const findings: Finding[] = [];
	let blankStreak = 0;
	for (const item of markdownLines(source)) {
		if (item.region !== "body") {
			blankStreak = 0;
			continue;
		}
		if (item.blank) {
			blankStreak += 1;
			if (blankStreak >= 2) {
				findings.push(
					finding("consecutive-blank-lines", "error", file, item.number, 1),
				);
			}
			continue;
		}
		blankStreak = 0;
		findings.push(...lintBodyLine(item, file));
	}
	return findings;
}

/**
 * 1行から、意味を変えずに取り除ける違反を除いた行を返す
 */
function fixLine(item: MarkdownLine): string {
	let line = item.line.replace(/[ \t]+$/, "");
	line = replaceOutsideInlineCode(line, HARD_BREAK, "");
	if (!item.structural) {
		line = line.replace(/\\+$/, "");
	}
	return line.replace(/[ \t]+$/, "");
}

/**
 * 意味を変えずに整形できる違反を取り除いた本文を返す
 */
export function fixSource(source: string): string {
	const bom = source.startsWith("\uFEFF") ? "\uFEFF" : "";
	const body = bom === "" ? source : source.slice(1);
	const eol = body.includes("\r\n") ? "\r\n" : "\n";
	const result: string[] = [];
	let previousBlank = false;
	for (const item of markdownLines(body)) {
		if (item.region !== "body") {
			previousBlank = false;
			result.push(item.line);
			continue;
		}
		const line = fixLine(item);
		if (line !== "") {
			previousBlank = false;
			result.push(line);
			continue;
		}
		if (!previousBlank) {
			previousBlank = true;
			result.push("");
		}
	}
	return bom + result.join(eol);
}
