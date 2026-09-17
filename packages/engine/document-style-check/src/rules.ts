import type { Located, Severity } from "@yuu1111/shared/findings";
import { type MarkdownLine, markdownLines } from "./audit";
import type { OptInRuleId, RuleId } from "./rule-ids";

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
	"fence-blank-lines": "a fenced code block is not surrounded by blank lines",
	"full-width-alphanumeric":
		"a full-width alphanumeric is not the ASCII character",
	"hard-break-html": "an HTML hard break adds spacing without meaning",
	"hard-tabs": "a hard tab is not spaces for indentation",
	"heading-level-jump": "a heading level skips a step",
	"heading-space":
		"a heading does not separate hashes and text with a single space",
	"heading-trailing-punctuation": "a heading does not end with punctuation",
	"japanese-comma":
		"a Japanese sentence does not separate clauses with a half-width comma",
	"japanese-period": "a Japanese sentence does not end with a period",
	"list-blank-lines": "a list is not surrounded by blank lines",
	"list-marker-consistency": "unordered list markers do not mix styles",
	"ordered-list-marker": "ordered list markers do not mix numbering styles",
	"reversed-link": "a link does not reverse brackets and parentheses",
	"single-trailing-newline": "a file does not end with a single newline",
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
const ORDERED_LIST_MARKER = /^([ \t]*)(\d+)([.)])(?=[ \t]+\S)/;
const HEADING_PREFIX = /^ {0,3}#{1,6}/;
const HEADING_MISSING_SPACE = /^ {0,3}#{1,6}(?![#\s])/;
const HEADING_EXTRA_SPACE = /^ {0,3}#{1,6}\s{2,}(?=\S)/;
const REVERSED_LINK = /\([^()]*\)\[[^[\]]*\]/g;
const HEADING_TRAILING_PUNCTUATION = /[。、，．.,;:!?！？]$/;

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
 * 本文行の順序リスト記号と位置を返す 順序リストでなければundefined
 *
 * @param line - 順序リスト記号を探す本文の1行
 * @returns 順序番号と区切り記号と0始まりの位置 順序リストでなければundefined
 */
export function orderedListMarker(
	line: string,
): { delimiter: string; number: number; position: number } | undefined {
	const match = ORDERED_LIST_MARKER.exec(line);
	if (match === null) {
		return undefined;
	}
	return {
		delimiter: match[3] ?? "",
		number: Number(match[2]),
		position: (match[1] ?? "").length,
	};
}

/**
 * 箇条書きまたは順序リストの項目行か判定する
 *
 * @param line - 判定する本文の1行
 * @returns リスト項目の行ならtrue
 */
export function isListItem(line: string): boolean {
	return (
		unorderedListMarker(line) !== undefined ||
		orderedListMarker(line) !== undefined
	);
}

/**
 * 見出しの`#`と本文の区切り位置を返す 見出しの体裁でなければundefined
 *
 * @param line - 見出しの区切りを探す本文の1行
 * @returns `#`の終わりの0始まりの位置 見出しでなければundefined
 */
export function headingSpaceColumn(line: string): number | undefined {
	if (!HEADING_MISSING_SPACE.test(line) && !HEADING_EXTRA_SPACE.test(line)) {
		return undefined;
	}
	return HEADING_PREFIX.exec(line)?.[0].length;
}

/**
 * 見出しの`#`と本文を半角スペース1つで区切る
 *
 * @param line - 区切りを揃える見出し行
 * @returns 区切りを揃えた見出し行
 */
export function normalizeHeadingSpace(line: string): string {
	const match = /^(\s*#{1,6})(.*)$/.exec(line);
	if (match === null) {
		return line;
	}
	const hashes = match[1] ?? "";
	const rest = match[2] ?? "";
	if (rest.trim() === "") {
		return hashes;
	}
	return `${hashes} ${rest.replace(/^\s+/, "")}`;
}

/**
 * 逆順リンクの位置を返す 無ければundefined
 *
 * @param line - 逆順リンクを探す本文の1行
 * @returns 最初の逆順リンクの0始まりの位置 見つからなければundefined
 */
export function findReversedLink(line: string): number | undefined {
	const spans = inlineCodeSpans(line);
	for (const match of line.matchAll(REVERSED_LINK)) {
		if (spans.some(([from, to]) => match.index >= from && match.index < to)) {
			continue;
		}
		if (match[0].includes(")[^")) {
			continue;
		}
		return match.index;
	}
	return undefined;
}

/**
 * 見出し末尾の句読点の位置を返す 無ければundefined
 *
 * @param line - 見出し末尾の句読点を探す本文の1行
 * @returns 末尾の句読点の0始まりの位置 見つからなければundefined
 */
export function findHeadingTrailingPunctuation(
	line: string,
): number | undefined {
	const trimmed = line.trimEnd();
	if (!HEADING_PREFIX.test(trimmed)) {
		return undefined;
	}
	const noClose = trimmed.replace(/\s#+\s*$/, "");
	const match = HEADING_TRAILING_PUNCTUATION.exec(noClose);
	return match === null ? undefined : match.index;
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
 * 同じ字下げの順序リストが守る採番の状態
 */
interface OrderedState {
	delimiter: string;
	indent: string;
	last: number;
	style: "ordered" | "repeat" | undefined;
}

/**
 * 採番の流儀から外れた順序リスト項目を違反として返す
 *
 * @param item - 判定する本文の1行
 * @param file - 指摘に載せるfileのpath
 * @param previous - 直前の同じ字下げの項目の状態 途切れたらundefined
 * @returns 検出と次の行へ渡す状態
 */
function orderedMarkerFinding(
	item: MarkdownLine,
	file: string,
	previous: OrderedState | undefined,
): { findings: Finding[]; state: OrderedState | undefined } {
	const marker = orderedListMarker(item.line);
	if (marker === undefined) {
		return { findings: [], state: undefined };
	}
	const indent = " ".repeat(marker.position);
	if (previous === undefined || previous.indent !== indent) {
		return {
			findings: [],
			state: {
				delimiter: marker.delimiter,
				indent,
				last: marker.number,
				style: undefined,
			},
		};
	}
	if (marker.delimiter !== previous.delimiter) {
		return {
			findings: [
				finding(
					"ordered-list-marker",
					"error",
					file,
					item.number,
					marker.position + 1,
				),
			],
			state: { ...previous, last: marker.number },
		};
	}
	if (previous.style === undefined) {
		if (marker.number === previous.last) {
			return {
				findings: [],
				state: { ...previous, last: marker.number, style: "repeat" },
			};
		}
		if (marker.number === previous.last + 1) {
			return {
				findings: [],
				state: { ...previous, last: marker.number, style: "ordered" },
			};
		}
		return {
			findings: [
				finding(
					"ordered-list-marker",
					"error",
					file,
					item.number,
					marker.position + 1,
				),
			],
			state: { ...previous, last: marker.number },
		};
	}
	const expected =
		previous.style === "repeat" ? previous.last : previous.last + 1;
	if (marker.number !== expected) {
		return {
			findings: [
				finding(
					"ordered-list-marker",
					"error",
					file,
					item.number,
					marker.position + 1,
				),
			],
			state: { ...previous, last: marker.number },
		};
	}
	return { findings: [], state: { ...previous, last: marker.number } };
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
	findings.push(...lintHeadingAndLink(item, masked, file));
	return findings;
}

/**
 * フェンス開始行の前に空行が要るか判定する
 */
function blankBeforeFence(
	item: MarkdownLine,
	previous: MarkdownLine | undefined,
): boolean {
	return (
		item.region === "fence-open" && previous !== undefined && !previous.blank
	);
}

/**
 * フェンス終了行の後に空行が要るか判定する
 */
function blankAfterFence(
	item: MarkdownLine,
	next: MarkdownLine | undefined,
): boolean {
	return item.region === "fence-close" && next !== undefined && !next.blank;
}

/**
 * リスト開始行の前に空行が要るか判定する
 */
function blankBeforeList(
	line: string,
	previous: MarkdownLine | undefined,
): boolean {
	return (
		isListItem(line) &&
		previous !== undefined &&
		previous.region === "body" &&
		!previous.blank &&
		!isListItem(previous.line)
	);
}

/**
 * リスト終了行の後に空行が要るか判定する
 */
function blankAfterList(line: string, next: MarkdownLine | undefined): boolean {
	return (
		isListItem(line) &&
		next !== undefined &&
		next.region === "body" &&
		!next.blank &&
		!isListItem(next.line)
	);
}

/**
 * 見出しの体裁とリンクの向きと字下げを検出する
 */
function lintHeadingAndLink(
	item: MarkdownLine,
	masked: string,
	file: string,
): Finding[] {
	const findings: Finding[] = [];
	const headingSpace = headingSpaceColumn(item.line);
	if (headingSpace !== undefined) {
		findings.push(
			finding("heading-space", "error", file, item.number, headingSpace + 1),
		);
	}
	const trailingPunctuation = findHeadingTrailingPunctuation(item.line);
	if (trailingPunctuation !== undefined) {
		findings.push(
			finding(
				"heading-trailing-punctuation",
				"warning",
				file,
				item.number,
				trailingPunctuation + 1,
			),
		);
	}
	const hardTab = masked.indexOf("\t");
	if (hardTab >= 0) {
		findings.push(
			finding("hard-tabs", "error", file, item.number, hardTab + 1),
		);
	}
	const reversedLink = findReversedLink(item.line);
	if (reversedLink !== undefined) {
		findings.push(
			finding("reversed-link", "error", file, item.number, reversedLink + 1),
		);
	}
	return findings;
}

/**
 * 本文以外の領域にあるフェンスの空行不足を検出する
 */
function lintFenceBlanks(
	item: MarkdownLine,
	previous: MarkdownLine | undefined,
	next: MarkdownLine | undefined,
	file: string,
): Finding[] {
	if (!blankBeforeFence(item, previous) && !blankAfterFence(item, next)) {
		return [];
	}
	return [finding("fence-blank-lines", "error", file, item.number, 1)];
}

/**
 * リスト前後の空行不足を検出する
 */
function lintListBlanks(
	line: string,
	previous: MarkdownLine | undefined,
	next: MarkdownLine | undefined,
	itemNumber: number,
	file: string,
): Finding[] {
	const findings: Finding[] = [];
	if (blankBeforeList(line, previous)) {
		findings.push(finding("list-blank-lines", "error", file, itemNumber, 1));
	}
	if (blankAfterList(line, next)) {
		findings.push(finding("list-blank-lines", "error", file, itemNumber, 1));
	}
	return findings;
}

/**
 * 空行を数えて連続空行を検出する
 *
 * @returns 検出と更新した連続数
 */
function lintBlankLine(
	streak: number,
	item: MarkdownLine,
	file: string,
): {
	findings: Finding[];
	streak: number;
} {
	const next = streak + 1;
	if (next < 2) {
		return { findings: [], streak: next };
	}
	return {
		findings: [
			finding("consecutive-blank-lines", "error", file, item.number, 1),
		],
		streak: next,
	};
}

/**
 * 順序リストの採番を追跡して混在を検出する
 */
function trackOrderedMarker(
	item: MarkdownLine,
	file: string,
	ordered: OrderedState | undefined,
	enabled: readonly OptInRuleId[],
): { findings: Finding[]; state: OrderedState | undefined } {
	if (!enabled.includes("ordered-list-marker")) {
		return { findings: [], state: undefined };
	}
	return orderedMarkerFinding(item, file, ordered);
}

/**
 * 有効なときだけ箇条書き記号を最初の記号へ揃える
 */
function alignMarkerLine(
	line: string,
	markers: MarkerState,
	consistentMarkers: boolean,
): string {
	if (!consistentMarkers || line === "") {
		return line;
	}
	return alignListMarker(line, markers);
}

/**
 * 文書末尾の改行不足または重複を検出する
 */
function lintTrailingNewline(source: string, file: string): Finding[] {
	const stripped = source.replace(/^\uFEFF/, "");
	const single = /(\r?\n)$/.test(stripped) && !/(\r?\n){2}$/.test(stripped);
	if (stripped === "" || single) {
		return [];
	}
	const rows = stripped.split(/\r?\n/);
	const last = rows[rows.length - 1] ?? "";
	return [
		finding(
			"single-trailing-newline",
			"error",
			file,
			rows.length,
			last.length + 1,
		),
	];
}

/**
 * 本文文字列を検査して違反を検出する 既定ではopt-in ruleを実行しない
 *
 * @param source - 検査するMarkdownの本文文字列
 * @param file - 指摘に載せるfileのpath
 * @param enabled - 追加で有効にするopt-in ruleの識別子
 * @param disabled - 追加で無効にするruleの一覧
 * @returns 検出した違反の一覧
 */
export function lintSource(
	source: string,
	file: string,
	enabled: readonly OptInRuleId[] = [],
	disabled: readonly RuleId[] = [],
): Finding[] {
	const findings: Finding[] = [];
	const items = markdownLines(source);
	let blankStreak = 0;
	const markers: MarkerState = { marker: undefined };
	const headings: HeadingState = { level: 0 };
	let ordered: OrderedState | undefined;
	for (let index = 0; index < items.length; index += 1) {
		const item = items[index];
		if (item === undefined) {
			continue;
		}
		if (item.region !== "body") {
			blankStreak = 0;
			ordered = undefined;
			if (item.region === "fence-open") {
				findings.push(...fenceLanguageFinding(item, file));
			}
			findings.push(
				...lintFenceBlanks(item, items[index - 1], items[index + 1], file),
			);
			continue;
		}
		if (item.blank) {
			const blank = lintBlankLine(blankStreak, item, file);
			blankStreak = blank.streak;
			ordered = undefined;
			findings.push(...blank.findings);
			continue;
		}
		blankStreak = 0;
		findings.push(...lintBodyLine(item, file, enabled));
		findings.push(...headingJumpFinding(item, headings, file));
		findings.push(
			...lintListBlanks(
				item.line,
				items[index - 1],
				items[index + 1],
				item.number,
				file,
			),
		);
		if (enabled.includes("list-marker-consistency")) {
			findings.push(...markerFinding(item, markers, file));
		}
		const tracked = trackOrderedMarker(item, file, ordered, enabled);
		ordered = tracked.state;
		findings.push(...tracked.findings);
	}
	findings.push(...lintTrailingNewline(source, file));
	return findings.filter((finding) => !disabled.includes(finding.rule));
}

/**
 * 1行から、意味を変えずに取り除ける違反を除いた行を返す
 */
function fixLine(item: MarkdownLine, disabled: readonly RuleId[]): string {
	let line = item.line;
	if (!disabled.includes("hard-tabs")) {
		line = line.replace(/\t/g, "  ");
	}
	if (!disabled.includes("trailing-whitespace")) {
		line = line.replace(/[ \t]+$/, "");
	}
	if (!disabled.includes("hard-break-html")) {
		line = replaceOutsideInlineCode(line, HARD_BREAK, "");
	}
	if (!item.structural && !disabled.includes("trailing-backslash")) {
		line = line.replace(/\\+$/, "");
	}
	if (!disabled.includes("trailing-whitespace")) {
		line = line.replace(/[ \t]+$/, "");
	}
	if (
		!disabled.includes("heading-space") &&
		headingSpaceColumn(line) !== undefined
	) {
		line = normalizeHeadingSpace(line);
	}
	return line;
}

/**
 * 本文以外の領域を結果へ積み 前後の空行を補う
 *
 * @returns 積んだ末尾が空行ならtrue
 */
function pushNonBodyLine(
	item: MarkdownLine,
	previous: MarkdownLine | undefined,
	next: MarkdownLine | undefined,
	result: string[],
	fenceBlanks: boolean,
): boolean {
	if (fenceBlanks && blankBeforeFence(item, previous)) {
		result.push("");
	}
	result.push(item.line);
	if (fenceBlanks && blankAfterFence(item, next)) {
		result.push("");
		return true;
	}
	return false;
}

/**
 * 本文行を結果へ積み リスト前後の空行を補う
 *
 * @returns 積んだ末尾が空行ならtrue
 */
function pushBodyLine(
	line: string,
	previous: MarkdownLine | undefined,
	next: MarkdownLine | undefined,
	result: string[],
	listBlanks: boolean,
): boolean {
	if (listBlanks && blankBeforeList(line, previous)) {
		result.push("");
	}
	result.push(line);
	if (listBlanks && blankAfterList(line, next)) {
		result.push("");
		return true;
	}
	return false;
}

/**
 * 空行を結果へ積む 連続空行をそのまま積む指定のときは直前が空行でも積む
 *
 * @param result - 積み先の行一覧
 * @param keepConsecutive - 連続空行をそのまま積むか
 * @param previousBlank - 直前の行が空行か
 */
function appendBlankLine(
	result: string[],
	keepConsecutive: boolean,
	previousBlank: boolean,
): void {
	if (keepConsecutive || !previousBlank) {
		result.push("");
	}
}

/**
 * 意味を変えずに整形できる違反を取り除いた本文を返す
 *
 * @param source - 整形するMarkdownの本文文字列
 * @param enabled - 整形に加えて適用するopt-in ruleの識別子
 * @param disabled - 追加で無効にするruleの一覧
 * @returns 整形後の本文文字列
 */
export function fixSource(
	source: string,
	enabled: readonly OptInRuleId[] = [],
	disabled: readonly RuleId[] = [],
): string {
	const bom = source.startsWith("\uFEFF") ? "\uFEFF" : "";
	const body = bom === "" ? source : source.slice(1);
	const eol = body.includes("\r\n") ? "\r\n" : "\n";
	const items = markdownLines(body);
	const result: string[] = [];
	let previousBlank = false;
	const markers: MarkerState = { marker: undefined };
	const consistentMarkers =
		enabled.includes("list-marker-consistency") &&
		!disabled.includes("list-marker-consistency");
	const fenceBlanks = !disabled.includes("fence-blank-lines");
	const listBlanks = !disabled.includes("list-blank-lines");
	for (let index = 0; index < items.length; index += 1) {
		const item = items[index];
		if (item === undefined) {
			continue;
		}
		if (item.region !== "body") {
			previousBlank = pushNonBodyLine(
				item,
				items[index - 1],
				items[index + 1],
				result,
				fenceBlanks,
			);
			continue;
		}
		const line = alignMarkerLine(
			fixLine(item, disabled),
			markers,
			consistentMarkers,
		);
		if (line === "") {
			appendBlankLine(
				result,
				disabled.includes("consecutive-blank-lines"),
				previousBlank,
			);
			previousBlank = true;
			continue;
		}
		previousBlank = pushBodyLine(
			line,
			items[index - 1],
			items[index + 1],
			result,
			listBlanks,
		);
	}
	let fixed = bom + result.join(eol);
	if (
		!disabled.includes("single-trailing-newline") &&
		fixed.replace(/^\uFEFF/, "") !== ""
	) {
		fixed = fixed.replace(/(\r?\n)*$/, eol);
	}
	return fixed;
}
