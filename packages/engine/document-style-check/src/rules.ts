import type { Located, Severity } from "@yuu1111/shared/findings";
import { type MarkdownLine, markdownLines } from "./audit";
import { OPT_IN_RULE_IDS, type OptInRuleId, type RuleId } from "./rule-ids";

export type { OptInRuleId };

/**
 * 検出した違反1件の内容と位置
 */
export interface Finding extends Located {
	message: string;
	rule: RuleId;
	severity: Severity;
}

const MESSAGES: Record<RuleId, string> = {
	"code-fence-language":
		"a code fence without a language renders without highlighting",
	"consecutive-blank-lines":
		"consecutive blank lines add spacing without meaning",
	"date-anchored-statement": "a check date is not the identity of the subject",
	"empty-link": "a link has no text or no destination",
	"full-width-alphanumeric":
		"a full-width alphanumeric is not the ASCII character",
	"hard-break-html": "an HTML hard break adds spacing without meaning",
	"heading-level-jump": "a heading level skips a step",
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
const FENCE_OPEN = /^ {0,3}(?:`{3,}|~{3,})/;
const HEADING = /^(#{1,6})(?:\s|$)/;
const EMPTY_LINK = /\[([^\]]*)\]\(([^)]*)\)/g;

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
 * フェンス開始行の言語指定を返す
 *
 * @param line - 言語指定を読むフェンス開始行
 * @returns フェンス記号の後ろの言語指定 指定が無ければ空文字
 */
export function fenceLanguage(line: string): string {
	return line.replace(FENCE_OPEN, "").trim();
}

/**
 * 本文行の見出しレベルを返す 見出しでなければundefined
 *
 * @param line - 見出しレベルを読む本文の1行
 * @returns 見出しの`#`の数 見出しでなければundefined
 */
export function headingLevel(line: string): number | undefined {
	const hashes = HEADING.exec(line)?.[1];
	return hashes === undefined ? undefined : hashes.length;
}

/**
 * 空のリンクラベルまたは空のリンク先を持つリンクの位置を返す 無ければundefined
 *
 * @param line - 空リンクを探す本文の1行
 * @returns 最初の空リンクの0始まりの位置 見つからなければundefined
 */
export function findEmptyLink(line: string): number | undefined {
	const spans = inlineCodeSpans(line);
	for (const match of line.matchAll(EMPTY_LINK)) {
		if (spans.some(([from, to]) => match.index >= from && match.index < to)) {
			continue;
		}
		if (match.index > 0 && line[match.index - 1] === "!") {
			continue;
		}
		const label = match[1] ?? "";
		const target = match[2] ?? "";
		if (label.trim() === "" || target.trim() === "") {
			return match.index;
		}
	}
	return undefined;
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
 * 直前の見出しレベルを保持する
 */
interface HeadingState {
	level: number;
}

/**
 * 言語指定の無いフェンスを違反として返す
 */
function fenceLanguageFinding(item: MarkdownLine, file: string): Finding[] {
	if (fenceLanguage(item.line) !== "") {
		return [];
	}
	const indent = /^ */.exec(item.line)?.[0].length ?? 0;
	return [
		finding("code-fence-language", "error", file, item.number, indent + 1),
	];
}

/**
 * 一段を超えて飛んだ見出しを違反として返す
 */
function headingJumpFinding(
	item: MarkdownLine,
	state: HeadingState,
	file: string,
): Finding[] {
	const level = headingLevel(item.line);
	if (level === undefined) {
		return [];
	}
	const previous = state.level;
	state.level = level;
	if (previous === 0 || level <= previous + 1) {
		return [];
	}
	return [finding("heading-level-jump", "warning", file, item.number, 1)];
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
 * インラインコードの範囲を返す
 */
function inlineCodeSpans(line: string): [number, number][] {
	const spans: [number, number][] = [];
	for (const match of line.matchAll(INLINE_CODE)) {
		spans.push([match.index, match.index + match[0].length]);
	}
	return spans;
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
	const emptyLink = findEmptyLink(item.line);
	if (emptyLink !== undefined) {
		findings.push(
			finding("empty-link", "error", file, item.number, emptyLink + 1),
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
	const headings: HeadingState = { level: 0 };
	for (const item of markdownLines(source)) {
		if (item.region !== "body") {
			blankStreak = 0;
			if (item.region === "fence-open") {
				findings.push(...fenceLanguageFinding(item, file));
			}
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
		findings.push(...headingJumpFinding(item, headings, file));
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
