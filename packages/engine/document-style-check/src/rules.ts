import type { Located, Severity } from "@yuu1111/shared/findings";
import { type MarkdownLine, markdownLines } from "./audit";

/**
 * document-style-checkが報告するruleの識別子一覧
 */
export const RULE_IDS = [
	"consecutive-blank-lines",
	"date-anchored-statement",
	"full-width-alphanumeric",
	"hard-break-html",
	"japanese-comma",
	"japanese-period",
	"list-marker-consistency",
	"trailing-backslash",
	"trailing-whitespace",
] as const;

/**
 * RULE_IDSが定義するrule識別子のunion型
 */
export type RuleId = (typeof RULE_IDS)[number];

/**
 * 既定では実行せず--enableで明示的に有効にするruleの識別子一覧
 */
export const OPT_IN_RULE_IDS = [
	"full-width-alphanumeric",
	"japanese-comma",
	"japanese-period",
	"list-marker-consistency",
] as const;

/**
 * OPT_IN_RULE_IDSが定義するrule識別子のunion型
 */
export type OptInRuleId = (typeof OPT_IN_RULE_IDS)[number];

/**
 * 検出した違反1件の内容と位置
 */
export interface Finding extends Located {
	message: string;
	rule: RuleId;
	severity: Severity;
}

const MESSAGES: Record<RuleId, string> = {
	"consecutive-blank-lines":
		"consecutive blank lines add spacing without meaning",
	"date-anchored-statement": "a check date is not the identity of the subject",
	"full-width-alphanumeric":
		"a full-width alphanumeric is not the ASCII character",
	"hard-break-html": "an HTML hard break adds spacing without meaning",
	"japanese-comma":
		"a Japanese sentence does not separate clauses with a half-width comma",
	"japanese-period": "a Japanese sentence does not end with a period",
	"list-marker-consistency": "unordered list markers do not mix styles",
	"trailing-backslash": "a trailing backslash adds spacing without meaning",
	"trailing-whitespace": "trailing whitespace is not part of the content",
};

const INLINE_CODE = /`+[^`]*`+/g;
const HARD_BREAK = /<br\s*\/?>/gi;
const DATE_ANCHOR =
	/\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s*に)?(?:確認|時点|現在|版)|(?:確認|執筆|作成)(?:した)?時点/;
const JAPANESE_PERIOD = "。";
const HALF_WIDTH_COMMA = ",";
const JAPANESE_CHARACTER = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;
const FULL_WIDTH_ALPHANUMERIC = /[\uff10-\uff19\uff21-\uff3a\uff41-\uff5a]/;
const THEMATIC_BREAK = /^\s*(?:[-*_]\s*){3,}$/;
const UNORDERED_LIST_MARKER = /^([ \t]*)([-+*])(?=[ \t]+\S)/;

/**
 * --enableの値を検証して重複を除く 未知のrule名は設定errorにする
 *
 * @param values - --enableで指定されたrule名の一覧
 * @returns 検証を通ったopt-in ruleの識別子
 */
export function parseEnabledRules(values: readonly string[]): OptInRuleId[] {
	const enabled: OptInRuleId[] = [];
	for (const value of values) {
		if (!(OPT_IN_RULE_IDS as readonly string[]).includes(value)) {
			throw new Error(`unknown rule: ${value}`);
		}
		const rule = value as OptInRuleId;
		if (!enabled.includes(rule)) {
			enabled.push(rule);
		}
	}
	return enabled;
}

/**
 * 本文行にある最初の日本語句点の位置を返す 無ければ-1を返す
 *
 * @param line - 句点を探す本文の1行
 * @returns 最初の句点の0始まりの位置 見つからなければ-1
 */
export function findJapanesePeriod(line: string): number {
	return line.indexOf(JAPANESE_PERIOD);
}

/**
 * 日本語に隣接する半角カンマの位置を返す 無ければ-1を返す
 *
 * @param line - 半角カンマを探す本文の1行
 * @returns 最初の半角カンマの0始まりの位置 見つからなければ-1
 */
export function findJapaneseComma(line: string): number {
	for (let index = 0; index < line.length; index += 1) {
		if (line[index] !== HALF_WIDTH_COMMA) {
			continue;
		}
		const before = line[index - 1] ?? "";
		const after = line[index + 1] ?? "";
		if (JAPANESE_CHARACTER.test(before) || JAPANESE_CHARACTER.test(after)) {
			return index;
		}
	}
	return -1;
}

/**
 * 全角英数字の位置を返す 無ければ-1を返す
 *
 * @param line - 全角英数字を探す本文の1行
 * @returns 最初の全角英数字の0始まりの位置 見つからなければ-1
 */
export function findFullWidthAlphanumeric(line: string): number {
	return line.search(FULL_WIDTH_ALPHANUMERIC);
}

/**
 * 本文行の箇条書き記号と位置を返す 箇条書きでなければundefined
 *
 * @param line - 箇条書き記号を探す本文の1行
 * @returns 箇条書き記号と0始まりの位置 箇条書きでなければundefined
 */
export function unorderedListMarker(
	line: string,
): { marker: string; position: number } | undefined {
	if (THEMATIC_BREAK.test(line)) {
		return undefined;
	}
	const match = UNORDERED_LIST_MARKER.exec(line);
	const marker = match?.[2];
	if (marker === undefined) {
		return undefined;
	}
	return { marker, position: (match?.[1] ?? "").length };
}

/**
 * 箇条書き記号を指定した記号へ揃える
 */
function normalizeListMarker(line: string, marker: string): string {
	return line.replace(
		UNORDERED_LIST_MARKER,
		(_match, indent: string) => `${indent}${marker}`,
	);
}

/**
 * 最初に見つけた箇条書き記号を、以降の判定の基準として保持する
 */
interface MarkerState {
	marker: string | undefined;
}

/**
 * 箇条書き記号を最初の記号へ揃えた行を返す
 */
function alignListMarker(line: string, state: MarkerState): string {
	const marker = unorderedListMarker(line);
	if (marker === undefined) {
		return line;
	}
	if (state.marker === undefined) {
		state.marker = marker.marker;
		return line;
	}
	return marker.marker === state.marker
		? line
		: normalizeListMarker(line, state.marker);
}

/**
 * 最初の記号と違う箇条書き記号を違反として返す
 */
function markerFinding(
	item: MarkdownLine,
	state: MarkerState,
	file: string,
): Finding[] {
	const marker = unorderedListMarker(item.line);
	if (marker === undefined) {
		return [];
	}
	if (state.marker === undefined) {
		state.marker = marker.marker;
		return [];
	}
	if (marker.marker === state.marker) {
		return [];
	}
	return [
		finding(
			"list-marker-consistency",
			"error",
			file,
			item.number,
			marker.position + 1,
		),
	];
}

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
function lintBodyLine(
	item: MarkdownLine,
	file: string,
	enabled: readonly OptInRuleId[],
): Finding[] {
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
	if (enabled.includes("japanese-period")) {
		const period = findJapanesePeriod(masked);
		if (period >= 0) {
			findings.push(
				finding("japanese-period", "error", file, item.number, period + 1),
			);
		}
	}
	if (enabled.includes("japanese-comma")) {
		const comma = findJapaneseComma(masked);
		if (comma >= 0) {
			findings.push(
				finding("japanese-comma", "error", file, item.number, comma + 1),
			);
		}
	}
	if (enabled.includes("full-width-alphanumeric")) {
		const wide = findFullWidthAlphanumeric(masked);
		if (wide >= 0) {
			findings.push(
				finding(
					"full-width-alphanumeric",
					"error",
					file,
					item.number,
					wide + 1,
				),
			);
		}
	}
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
 * 本文文字列を検査して違反を検出する 既定ではopt-in ruleを実行しない
 *
 * @param source - 検査するMarkdownの本文文字列
 * @param file - 指摘に載せるfileのpath
 * @param enabled - 追加で有効にするopt-in ruleの識別子
 * @returns 検出した違反の一覧
 */
export function lintSource(
	source: string,
	file: string,
	enabled: readonly OptInRuleId[] = [],
): Finding[] {
	const findings: Finding[] = [];
	let blankStreak = 0;
	const markers: MarkerState = { marker: undefined };
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
		findings.push(...lintBodyLine(item, file, enabled));
		if (enabled.includes("list-marker-consistency")) {
			findings.push(...markerFinding(item, markers, file));
		}
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
 *
 * @param source - 整形するMarkdownの本文文字列
 * @param enabled - 整形に加えて適用するopt-in ruleの識別子
 * @returns 整形後の本文文字列
 */
export function fixSource(
	source: string,
	enabled: readonly OptInRuleId[] = [],
): string {
	const bom = source.startsWith("\uFEFF") ? "\uFEFF" : "";
	const body = bom === "" ? source : source.slice(1);
	const eol = body.includes("\r\n") ? "\r\n" : "\n";
	const result: string[] = [];
	let previousBlank = false;
	const markers: MarkerState = { marker: undefined };
	const consistentMarkers = enabled.includes("list-marker-consistency");
	for (const item of markdownLines(body)) {
		if (item.region !== "body") {
			previousBlank = false;
			result.push(item.line);
			continue;
		}
		let line = fixLine(item);
		if (consistentMarkers && line !== "") {
			line = alignListMarker(line, markers);
		}
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
