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
	"bare-url": "a bare URL is not an autolink",
	"code-fence-language":
		"a code fence without a language renders without highlighting",
	"code-span-padding": "a code span contains padding without meaning",
	"consecutive-blank-lines":
		"consecutive blank lines add spacing without meaning",
	"date-anchored-statement": "a check date is not the identity of the subject",
	"descriptive-link-text": "link text does not describe its destination",
	"emphasis-as-heading": "emphasis is not a heading",
	"emphasis-marker": "emphasis markers do not mix styles",
	"emphasis-padding": "emphasis markers contain padding without meaning",
	"empty-link": "a link has no text or no destination",
	"fence-blank-lines": "a fenced code block is not surrounded by blank lines",
	"fence-style": "code fences do not use one style",
	"first-line-heading": "a document does not start with a top-level heading",
	"full-width-alphanumeric":
		"a full-width alphanumeric is not the ASCII character",
	"hard-break-html": "an HTML hard break adds spacing without meaning",
	"hard-tabs": "a hard tab is not spaces for indentation",
	"heading-blank-lines": "a heading is not surrounded by blank lines",
	"heading-indent": "a heading starts with indentation",
	"heading-level-jump": "a heading level skips a step",
	"heading-space":
		"a heading does not separate hashes and text with a single space",
	"heading-trailing-punctuation": "a heading does not end with punctuation",
	"indented-code-block": "an indented code block is not a fence",
	"japanese-comma":
		"a Japanese sentence does not separate clauses with a half-width comma",
	"japanese-period": "a Japanese sentence does not end with a period",
	"link-label-padding": "link text contains padding without meaning",
	"list-blank-lines": "a list is not surrounded by blank lines",
	"list-marker-consistency": "unordered list markers do not mix styles",
	"list-marker-space":
		"a list marker does not separate its content with a single space",
	"ordered-list-marker": "ordered list markers do not mix numbering styles",
	"reversed-link": "a link does not reverse brackets and parentheses",
	"setext-heading": "a setext heading does not show its level",
	"single-top-level-heading": "a document has more than one top-level heading",
	"single-trailing-newline": "a file does not end with a single newline",
	"table-blank-lines": "a table is not surrounded by blank lines",
	"table-column-count": "a table row has more columns than its header",
	"thematic-break-style": "thematic breaks do not use one style",
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
const HEADING_LINE = /^ {0,3}#{1,6}(?:\s|$)/;
const HEADING_INDENTED = /^( {1,3})(?=#{1,6}(?:\s|$))/;
const TABLE_ROW = /^\s*\|/;
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)\s*$/;
const LIST_MARKER_SPACE = /^([ \t]*)([-+*]|\d+[.)])([ \t]+)(?=\S)/;
const EMPHASIS_SPAN = /(\*\*|__|\*|_)(\S(?:[\s\S]*?\S)?)\1/g;
const EMPHASIS_TRAILING_PUNCTUATION = /[.,;:!?。，；：！？]$/;
const FENCE_MARKER = /^( {0,3})(`{3,}|~{3,})/;
const BARE_URL = /https?:\/\/[^\s<>`]+/g;
const URL_BOUNDARY = /[<([!"']/;
const URL_TRAILING = /[.,;:!?、。！？）)\]"'」』]+$/;
const EMPHASIS_PADDED = /(\*\*|__|\*|_)((?:(?!\1)[^\n])+)\1/g;
const CODE_SPAN = /(`+)([^`]+)\1/g;
const LINK_LABEL = /\[([^[\]]*)\](?=\(|\[)/g;
const INDENTED_CODE = /^(?: {4}|\t)/;
const TABLE_DELIMITER = /^[\s|:-]+$/;
const TOP_LEVEL_HEADING = /^ {0,3}#(?:\s|$)/;
const LINK_TEXT_EDGE =
	/^[.,;:!?。、，．；：！？「」『』（）()]+|[.,;:!?。、，．；：！？「」『』（）()]+$/g;
const PROHIBITED_LINK_TEXTS = new Set([
	"click here",
	"here",
	"link",
	"more",
	"こちら",
	"ここ",
	"詳細はこちら",
	"リンク",
]);

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
 * リストの塊を構成する行か判定する 字下げした継続行を含む
 *
 * @param line - 判定する本文の1行
 * @returns リスト項目かその継続行ならtrue
 */
function isListBlock(line: string): boolean {
	return isListItem(line) || /^(?: {2,}|\t)/.test(line);
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
 * 見出し行の体裁か判定する 字下げ3までを含む
 *
 * @param line - 判定する本文の1行
 * @returns 見出し行ならtrue
 */
function isHeadingLine(line: string): boolean {
	return HEADING_LINE.test(line);
}

/**
 * 字下げした見出しの字下げ幅を返す 無ければundefined
 *
 * @param line - 字下げを読む本文の1行
 * @returns 先頭の半角スペースの数 字下げした見出しでなければundefined
 */
function headingIndent(line: string): number | undefined {
	const match = HEADING_INDENTED.exec(line);
	return match === null ? undefined : (match[1] ?? "").length;
}

/**
 * 見出し行の字下げを取り除く
 *
 * @param line - 字下げを除く見出し行
 * @returns 先頭から`#`までを詰めた見出し行
 */
function normalizeHeadingIndent(line: string): string {
	return line.replace(HEADING_INDENTED, "");
}

/**
 * 表の行か判定する
 *
 * @param line - 判定する本文の1行
 * @returns 表の行ならtrue
 */
function isTableRow(line: string): boolean {
	return TABLE_ROW.test(line);
}

/**
 * リスト記号の後ろの区切り位置を返す 半角スペース1つならundefined
 *
 * @param line - 区切りを読む本文の1行
 * @returns 区切りの0始まりの位置 1つの半角スペースで区切ったリストでなければundefined
 */
function findListMarkerSpace(line: string): number | undefined {
	if (THEMATIC_BREAK.test(line)) {
		return undefined;
	}
	const match = LIST_MARKER_SPACE.exec(line);
	if (match === null || match[3] === " ") {
		return undefined;
	}
	return (match[1] ?? "").length + (match[2] ?? "").length;
}

/**
 * リスト記号の後ろを半角スペース1つへ揃える
 *
 * @param line - 区切りを揃える本文の1行
 * @returns 区切りを半角スペース1つにした本文の1行
 */
function normalizeListMarkerSpace(line: string): string {
	const match = LIST_MARKER_SPACE.exec(line);
	if (match === null) {
		return line;
	}
	const head = `${match[1] ?? ""}${match[2] ?? ""}`;
	return `${head} ${line.slice(match[0].length)}`;
}

/**
 * 語の途中で開く強調記号か判定する
 *
 * @param marker - 強調記号
 * @param line - 強調記号を含む本文の1行
 * @param position - 強調記号の0始まりの位置
 * @returns 語の途中の強調記号ならtrue
 */
function opensIntraword(
	marker: string,
	line: string,
	position: number,
): boolean {
	return marker.startsWith("_") && /[A-Za-z0-9]/.test(line[position - 1] ?? "");
}

/**
 * 本文行が使う強調の記号と範囲を順に返す
 *
 * @param line - 強調記号を探すマスク済みの1行
 * @returns 記号の種類と範囲の一覧
 */
function emphasisMarkers(
	line: string,
): { end: number; marker: string; position: number; width: number }[] {
	const markers: {
		end: number;
		marker: string;
		position: number;
		width: number;
	}[] = [];
	for (const match of line.matchAll(EMPHASIS_SPAN)) {
		const raw = match[1] ?? "";
		if (opensIntraword(raw, line, match.index)) {
			continue;
		}
		markers.push({
			end: match.index + match[0].length,
			marker: raw.slice(0, 1),
			position: match.index,
			width: raw.length,
		});
	}
	return markers;
}

/**
 * 強調記号を指定した種類へ揃える
 *
 * @param line - 強調記号を揃える本文の1行
 * @param marker - 揃え先の強調記号
 * @returns 強調記号を揃えた本文の1行
 */
function alignEmphasisMarker(line: string, marker: string): string {
	const spans = inlineCodeSpans(line);
	let result = "";
	let cursor = 0;
	for (const match of line.matchAll(EMPHASIS_SPAN)) {
		const start = match.index;
		const current = match[1] ?? "";
		if (
			spans.some(([from, to]) => start >= from && start < to) ||
			opensIntraword(current, line, start) ||
			current.startsWith(marker)
		) {
			continue;
		}
		result +=
			line.slice(cursor, start) +
			marker.repeat(current.length) +
			(match[2] ?? "") +
			marker.repeat(current.length);
		cursor = start + match[0].length;
	}
	return result + line.slice(cursor);
}

/**
 * 強調だけの本文行を違反として返す
 *
 * @param item - 判定する本文の1行
 * @param masked - インラインコードを空白に置き換えた同じ行
 * @param file - 指摘に載せるfileのpath
 * @returns 強調を見出しの代わりに使った検出
 */
function emphasisHeadingFinding(
	item: MarkdownLine,
	masked: string,
	file: string,
): Finding[] {
	if (item.structural) {
		return [];
	}
	const trimmed = masked.trim();
	const leading = masked.length - masked.trimStart().length;
	const first = emphasisMarkers(masked)[0];
	if (
		first === undefined ||
		first.position !== leading ||
		first.end !== leading + trimmed.length
	) {
		return [];
	}
	const inner = masked.slice(
		first.position + first.width,
		first.end - first.width,
	);
	if (EMPHASIS_TRAILING_PUNCTUATION.test(inner)) {
		return [];
	}
	return [finding("emphasis-as-heading", "warning", file, item.number, 1)];
}

/**
 * 直前の行がsetext見出しの本文か判定する
 *
 * @param previous - 直前の行
 * @returns 段落の本文ならtrue
 */
function isSetextParagraph(previous: MarkdownLine | undefined): boolean {
	return (
		previous !== undefined &&
		previous.region === "body" &&
		!previous.blank &&
		!previous.structural
	);
}

/**
 * 区切り線として扱える行か判定する
 *
 * @param line - 判定する本文の1行
 * @param previous - 直前の行
 * @returns 区切り線ならtrue
 */
function isThematicBreakLine(
	line: string,
	previous: MarkdownLine | undefined,
): boolean {
	if (!THEMATIC_BREAK.test(line)) {
		return false;
	}
	if (!line.trim().startsWith("-")) {
		return true;
	}
	return !isSetextParagraph(previous);
}

/**
 * 区切り線の流儀を返す 無ければundefined
 *
 * @param line - 流儀を読む本文の1行
 * @returns 空白を畳んだ区切り線 区切り線でなければundefined
 */
function thematicBreakStyle(line: string): string | undefined {
	return THEMATIC_BREAK.test(line)
		? line.trim().replace(/\s+/g, " ")
		: undefined;
}

/**
 * setext見出しの下線の位置を返す 無ければundefined
 *
 * @param line - 下線を探す本文の1行
 * @param previous - 直前の行
 * @returns 下線の0始まりの位置 setext見出しの下線でなければundefined
 */
function findSetextUnderline(
	line: string,
	previous: MarkdownLine | undefined,
): number | undefined {
	if (!SETEXT_UNDERLINE.test(line) || !isSetextParagraph(previous)) {
		return undefined;
	}
	const trimmed = line.trimStart();
	return line.length - trimmed.length;
}

/**
 * インラインコードの外側にある裸のURLの範囲を返す
 *
 * @param line - 裸のURLを探す本文の1行
 * @returns 角括弧で囲まれていないURLの範囲の一覧
 */
function bareUrlSpans(line: string): { from: number; to: number }[] {
	const code = inlineCodeSpans(line);
	const spans: { from: number; to: number }[] = [];
	for (const match of line.matchAll(BARE_URL)) {
		const from = match.index;
		if (code.some(([start, end]) => from >= start && from < end)) {
			continue;
		}
		if (URL_BOUNDARY.test(line[from - 1] ?? "")) {
			continue;
		}
		const text = match[0].replace(URL_TRAILING, "");
		if (text === "") {
			continue;
		}
		spans.push({ from, to: from + text.length });
	}
	return spans;
}

/**
 * 裸のURLを角括弧で囲む
 *
 * @param line - 裸のURLを囲む本文の1行
 * @returns 裸のURLを角括弧で囲んだ本文の1行
 */
function normalizeBareUrls(line: string): string {
	const spans = bareUrlSpans(line);
	if (spans.length === 0) {
		return line;
	}
	let result = "";
	let cursor = 0;
	for (const { from, to } of spans) {
		result += `${line.slice(cursor, from)}<${line.slice(from, to)}>`;
		cursor = to;
	}
	return result + line.slice(cursor);
}

/**
 * 強調記号の内側に空白がある範囲を返す
 *
 * @param line - 詰め物を探す本文の1行
 * @returns 詰め物のある強調の範囲と中身と記号の一覧
 */
function paddedEmphasisSpans(
	line: string,
): { end: number; from: number; inner: string; marker: string }[] {
	const code = inlineCodeSpans(line);
	const spans: { end: number; from: number; inner: string; marker: string }[] =
		[];
	for (const match of line.matchAll(EMPHASIS_PADDED)) {
		const from = match.index;
		const marker = match[1] ?? "";
		const inner = match[2] ?? "";
		if (
			code.some(([start, end]) => from >= start && from < end) ||
			opensIntraword(marker, line, from) ||
			inner.trim() === "" ||
			inner === inner.trim()
		) {
			continue;
		}
		spans.push({ end: from + match[0].length, from, inner, marker });
	}
	return spans;
}

/**
 * 強調記号の内側の空白を取り除く
 *
 * @param line - 詰め物を除く本文の1行
 * @returns 強調記号の内側の空白を除いた本文の1行
 */
function normalizeEmphasisPadding(line: string): string {
	let result = "";
	let cursor = 0;
	for (const span of paddedEmphasisSpans(line)) {
		result +=
			line.slice(cursor, span.from) +
			span.marker +
			span.inner.trim() +
			span.marker;
		cursor = span.end;
	}
	return result + line.slice(cursor);
}

/**
 * 前後を半角スペース1つで詰めたコードスパンか判定する
 *
 * @param inner - コードスパンの中身
 * @returns 前後が半角スペース1つずつならtrue
 */
function isPaddedCodeSpan(inner: string): boolean {
	const content = inner.trim();
	return (
		content !== "" &&
		inner.length - content.length === 2 &&
		inner.startsWith(" ") &&
		inner.endsWith(" ") &&
		!/^`|`$/.test(content)
	);
}

/**
 * 前後を半角スペース1つで詰めたコードスパンの位置を返す 無ければundefined
 *
 * @param line - 詰め物を探す本文の1行
 * @returns コードスパンの0始まりの位置 詰め物が無ければundefined
 */
function findPaddedCodeSpan(line: string): number | undefined {
	for (const match of line.matchAll(CODE_SPAN)) {
		if (isPaddedCodeSpan(match[2] ?? "")) {
			return match.index;
		}
	}
	return undefined;
}

/**
 * コードスパンの内側の空白を取り除く
 *
 * @param line - 詰め物を除く本文の1行
 * @returns コードスパンの内側の空白を除いた本文の1行
 */
function normalizeCodeSpanPadding(line: string): string {
	let result = "";
	let cursor = 0;
	for (const match of line.matchAll(CODE_SPAN)) {
		const inner = match[2] ?? "";
		if (!isPaddedCodeSpan(inner)) {
			continue;
		}
		const marker = match[1] ?? "";
		result += line.slice(cursor, match.index) + marker + inner.trim() + marker;
		cursor = match.index + match[0].length;
	}
	return result + line.slice(cursor);
}

/**
 * リンクテキストの内側にある空白の位置を返す 無ければundefined
 *
 * @param line - 詰め物を探す本文の1行
 * @returns 空白の0始まりの位置 詰め物が無ければundefined
 */
function findLinkLabelPadding(line: string): number | undefined {
	for (const match of line.matchAll(LINK_LABEL)) {
		const from = match.index;
		if (from > 0 && line[from - 1] === "!") {
			continue;
		}
		const label = match[1] ?? "";
		if (label.trim() === "" || label === label.trim()) {
			continue;
		}
		const leading = label.length - label.trimStart().length;
		return leading > 0 ? from + 1 : from + 1 + label.trimEnd().length;
	}
	return undefined;
}

/**
 * リンクテキストの内側の空白を取り除く
 *
 * @param line - 詰め物を除く本文の1行
 * @returns リンクテキストの内側の空白を除いた本文の1行
 */
function normalizeLinkLabelPadding(line: string): string {
	let result = "";
	let cursor = 0;
	for (const match of line.matchAll(LINK_LABEL)) {
		const from = match.index;
		const label = match[1] ?? "";
		if (
			(from > 0 && line[from - 1] === "!") ||
			label.trim() === "" ||
			label === label.trim()
		) {
			continue;
		}
		result += `${line.slice(cursor, from)}[${label.trim()}]`;
		cursor = from + match[0].length;
	}
	return result + line.slice(cursor);
}

/**
 * リンクテキストを比較用に正規化する
 *
 * @param text - 正規化するリンクテキスト
 * @returns 空白を畳み前後の句読点を除いた小文字の文字列
 */
function normalizeLinkText(text: string): string {
	return text
		.replace(/[\s\u3000]+/g, " ")
		.trim()
		.toLowerCase()
		.replace(LINK_TEXT_EDGE, "")
		.trim();
}

/**
 * 行き先を説明しないリンクテキストの位置を返す 無ければundefined
 *
 * @param line - リンクテキストを探す本文の1行
 * @returns リンクラベルの0始まりの位置 該当しなければundefined
 */
function findDescriptiveLink(line: string): number | undefined {
	for (const match of line.matchAll(LINK_LABEL)) {
		const from = match.index;
		if (from > 0 && line[from - 1] === "!") {
			continue;
		}
		if (PROHIBITED_LINK_TEXTS.has(normalizeLinkText(match[1] ?? ""))) {
			return from;
		}
	}
	return undefined;
}

/**
 * 表の列数を数える
 *
 * @param line - 列数を数える表の行
 * @returns インラインコード内の区切りを除いた列数
 */
function cellCount(line: string): number {
	const masked = maskInlineCode(line).replace(/\\\|/g, "\u0000");
	const cells = masked.trim().replace(/^\|/, "").replace(/\|$/, "");
	return cells.split("|").length;
}

/**
 * 表の区切り行か判定する
 *
 * @param line - 判定する本文の1行
 * @returns 区切り行ならtrue
 */
function isTableDelimiter(line: string): boolean {
	return TABLE_DELIMITER.test(line) && line.includes("-");
}

/**
 * 表の行数と列数を保持する
 */
interface TableState {
	columns: number;
	rows: number;
}

/**
 * 見出しより列の多い表の行を違反として返す
 *
 * @param item - 判定する本文の1行
 * @param state - 表の行数と列数を保持する状態
 * @param file - 指摘に載せるfileのpath
 * @returns 列数が多い表の行の検出
 */
function tableColumnFinding(
	item: MarkdownLine,
	state: TableState,
	file: string,
): Finding[] {
	if (!isTableRow(item.line)) {
		state.rows = 0;
		return [];
	}
	const columns = cellCount(item.line);
	if (state.rows === 0) {
		state.rows = 1;
		return [];
	}
	if (state.rows === 1) {
		if (isTableDelimiter(item.line)) {
			state.columns = columns;
			state.rows = 2;
		}
		return [];
	}
	state.rows += 1;
	return state.columns > 0 && columns > state.columns
		? [finding("table-column-count", "error", file, item.number, 1)]
		: [];
}

/**
 * 字下げコードブロックの開始行を違反として返す
 *
 * @param items - 文書の行一覧
 * @param index - 判定する行の添字
 * @param file - 指摘に載せるfileのpath
 * @returns 字下げコードブロックの検出
 */
function indentedCodeFinding(
	items: MarkdownLine[],
	index: number,
	file: string,
): Finding[] {
	const item = items[index];
	if (
		item === undefined ||
		item.region !== "body" ||
		!INDENTED_CODE.test(item.line)
	) {
		return [];
	}
	const previous = items[index - 1];
	if (previous !== undefined && !previous.blank) {
		return [];
	}
	for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
		const candidate = items[cursor];
		if (candidate === undefined || candidate.blank) {
			continue;
		}
		if (candidate.region === "body" && isListItem(candidate.line)) {
			return [];
		}
		break;
	}
	return [finding("indented-code-block", "error", file, item.number, 1)];
}

/**
 * 2つ目以降のトップレベル見出しを違反として返す
 *
 * @param items - 文書の行一覧
 * @param file - 指摘に載せるfileのpath
 * @returns トップレベル見出しの重複の検出
 */
function topLevelHeadingFindings(
	items: MarkdownLine[],
	file: string,
): Finding[] {
	return items
		.filter(
			(item) => item.region === "body" && TOP_LEVEL_HEADING.test(item.line),
		)
		.slice(1)
		.map((item) =>
			finding("single-top-level-heading", "error", file, item.number, 1),
		);
}

/**
 * 先頭のトップレベル見出しの不足を違反として返す
 *
 * @param items - 文書の行一覧
 * @param file - 指摘に載せるfileのpath
 * @returns 先頭のトップレベル見出しの検出
 */
function firstHeadingFinding(items: MarkdownLine[], file: string): Finding[] {
	for (const item of items) {
		if (item.region === "frontmatter" || item.blank) {
			continue;
		}
		return TOP_LEVEL_HEADING.test(item.line)
			? []
			: [finding("first-line-heading", "error", file, item.number, 1)];
	}
	return [];
}

/**
 * 文書全体を対象にするopt-in ruleの検出を返す
 *
 * @param items - 文書の行一覧
 * @param enabled - 有効にするopt-in ruleの識別子
 * @param file - 指摘に載せるfileのpath
 * @returns 文書全体の検出
 */
function lintDocument(
	items: MarkdownLine[],
	enabled: readonly OptInRuleId[],
	file: string,
): Finding[] {
	const findings: Finding[] = [];
	if (enabled.includes("single-top-level-heading")) {
		findings.push(...topLevelHeadingFindings(items, file));
	}
	if (enabled.includes("first-line-heading")) {
		findings.push(...firstHeadingFinding(items, file));
	}
	return findings;
}

/**
 * 記号の内側の空白と裸のURLとリンクテキストを検出する
 *
 * @param item - 判定する本文の1行
 * @param file - 指摘に載せるfileのpath
 * @returns 詰め物と裸のURLとリンクテキストの検出
 */
function lintInlineSpacing(item: MarkdownLine, file: string): Finding[] {
	const findings: Finding[] = [];
	const bare = bareUrlSpans(item.line)[0];
	if (bare !== undefined) {
		findings.push(
			finding("bare-url", "error", file, item.number, bare.from + 1),
		);
	}
	const emphasis = paddedEmphasisSpans(item.line)[0];
	if (emphasis !== undefined) {
		findings.push(
			finding(
				"emphasis-padding",
				"error",
				file,
				item.number,
				emphasis.from + 1,
			),
		);
	}
	const code = findPaddedCodeSpan(item.line);
	if (code !== undefined) {
		findings.push(
			finding("code-span-padding", "error", file, item.number, code + 1),
		);
	}
	const label = findLinkLabelPadding(item.line);
	if (label !== undefined) {
		findings.push(
			finding("link-label-padding", "error", file, item.number, label + 1),
		);
	}
	const descriptive = findDescriptiveLink(item.line);
	if (descriptive !== undefined) {
		findings.push(
			finding(
				"descriptive-link-text",
				"error",
				file,
				item.number,
				descriptive + 1,
			),
		);
	}
	return findings;
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
 * 最初に見つけた書式の流儀を、以降の判定の基準として保持する
 */
interface StyleState {
	style: string | undefined;
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
 * 有効なopt-in ruleによる本文行の検出を返す
 *
 * @param item - 判定する本文の1行
 * @param masked - インラインコードを空白に置き換えた同じ行
 * @param enabled - 有効にするopt-in ruleの識別子
 * @param file - 指摘に載せるfileのpath
 * @returns 有効なopt-in ruleの検出
 */
function optInFindings(
	item: MarkdownLine,
	masked: string,
	enabled: readonly OptInRuleId[],
	file: string,
): Finding[] {
	const findings: Finding[] = [];
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
	return findings;
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
	findings.push(...optInFindings(item, masked, enabled, file));
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
	const markerSpace = findListMarkerSpace(item.line);
	if (markerSpace !== undefined) {
		findings.push(
			finding("list-marker-space", "error", file, item.number, markerSpace + 1),
		);
	}
	findings.push(...emphasisHeadingFinding(item, masked, file));
	findings.push(...lintHeadingAndLink(item, masked, file));
	findings.push(...lintInlineSpacing(item, file));
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
 * 塊の開始行の前に空行が要るか判定する
 *
 * @param line - 判定する本文の1行
 * @param previous - 直前の行
 * @param isBlock - 同じ塊を構成する行か判定する関数
 * @returns 空行が要るならtrue
 */
function blankBeforeBlock(
	line: string,
	previous: MarkdownLine | undefined,
	isBlock: (candidate: string) => boolean,
): boolean {
	return (
		isBlock(line) &&
		previous !== undefined &&
		previous.region === "body" &&
		!previous.blank &&
		!isBlock(previous.line)
	);
}

/**
 * 塊の終了行の後に空行が要るか判定する
 *
 * @param line - 判定する本文の1行
 * @param next - 次の行
 * @param isBlock - 同じ塊を構成する行か判定する関数
 * @returns 空行が要るならtrue
 */
function blankAfterBlock(
	line: string,
	next: MarkdownLine | undefined,
	isBlock: (candidate: string) => boolean,
): boolean {
	return (
		isBlock(line) &&
		next !== undefined &&
		next.region === "body" &&
		!next.blank &&
		!isBlock(next.line)
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
	const indent = headingIndent(item.line);
	if (indent !== undefined) {
		findings.push(finding("heading-indent", "error", file, item.number, 1));
	}
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
 * 本文以外の領域にある行を検出する
 *
 * @param item - 判定する行
 * @param previous - 直前の行
 * @param next - 次の行
 * @param enabled - 有効にするopt-in ruleの識別子
 * @param fences - 最初のフェンスの記号を保持する状態
 * @param file - 指摘に載せるfileのpath
 * @returns フェンスの言語指定と記号と空行不足の検出
 */
function lintNonBodyLine(
	item: MarkdownLine,
	previous: MarkdownLine | undefined,
	next: MarkdownLine | undefined,
	enabled: readonly OptInRuleId[],
	fences: StyleState,
	file: string,
): Finding[] {
	const findings: Finding[] = [];
	if (item.region === "fence-open") {
		findings.push(...fenceLanguageFinding(item, file));
		if (enabled.includes("fence-style")) {
			findings.push(...fenceStyleFinding(item, fences, file));
		}
	}
	findings.push(...lintFenceBlanks(item, previous, next, file));
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
 * 塊の前後にある空行不足を検出する
 *
 * @param rule - 検出に載せるrule識別子
 * @param line - 判定する本文の1行
 * @param previous - 直前の行
 * @param next - 次の行
 * @param isBlock - 同じ塊を構成する行か判定する関数
 * @param itemNumber - 指摘に載せる行番号
 * @param file - 指摘に載せるfileのpath
 * @returns 空行不足の検出
 */
function lintBlockBlanks(
	rule: RuleId,
	line: string,
	previous: MarkdownLine | undefined,
	next: MarkdownLine | undefined,
	isBlock: (candidate: string) => boolean,
	itemNumber: number,
	file: string,
): Finding[] {
	const findings: Finding[] = [];
	if (blankBeforeBlock(line, previous, isBlock)) {
		findings.push(finding(rule, "error", file, itemNumber, 1));
	}
	if (blankAfterBlock(line, next, isBlock)) {
		findings.push(finding(rule, "error", file, itemNumber, 1));
	}
	return findings;
}

/**
 * リスト、見出し、表の前後にある空行不足を検出する
 *
 * @param item - 判定する本文の1行
 * @param previous - 直前の行
 * @param next - 次の行
 * @param file - 指摘に載せるfileのpath
 * @returns 前後の空行不足の検出
 */
function lintBlockLines(
	item: MarkdownLine,
	previous: MarkdownLine | undefined,
	next: MarkdownLine | undefined,
	file: string,
): Finding[] {
	return [
		...lintBlockBlanks(
			"list-blank-lines",
			item.line,
			previous,
			next,
			isListBlock,
			item.number,
			file,
		),
		...lintBlockBlanks(
			"heading-blank-lines",
			item.line,
			previous,
			next,
			isHeadingLine,
			item.number,
			file,
		),
		...lintBlockBlanks(
			"table-blank-lines",
			item.line,
			previous,
			next,
			isTableRow,
			item.number,
			file,
		),
	];
}

/**
 * 有効なopt-in ruleによる流儀の混在を検出する
 *
 * @param item - 判定する本文の1行
 * @param masked - インラインコードを空白に置き換えた同じ行
 * @param previous - 直前の行
 * @param enabled - 有効にするopt-in ruleの識別子
 * @param breaks - 最初の区切り線の流儀を保持する状態
 * @param emphasis - 最初の強調記号を保持する状態
 * @param file - 指摘に載せるfileのpath
 * @returns 流儀の混在の検出
 */
function lintStyleLines(
	item: MarkdownLine,
	masked: string,
	previous: MarkdownLine | undefined,
	enabled: readonly OptInRuleId[],
	breaks: StyleState,
	emphasis: StyleState,
	file: string,
): Finding[] {
	const findings: Finding[] = [];
	if (enabled.includes("thematic-break-style")) {
		findings.push(...thematicBreakFinding(item, previous, breaks, file));
	}
	if (enabled.includes("emphasis-marker")) {
		findings.push(...emphasisMarkerFinding(item, masked, emphasis, file));
	}
	return findings;
}

/**
 * setext見出しの下線を違反として返す
 *
 * @param item - 判定する本文の1行
 * @param previous - 直前の行
 * @param file - 指摘に載せるfileのpath
 * @returns setext見出しの下線の検出
 */
function setextHeadingFinding(
	item: MarkdownLine,
	previous: MarkdownLine | undefined,
	file: string,
): Finding[] {
	const underline = findSetextUnderline(item.line, previous);
	if (underline === undefined) {
		return [];
	}
	return [
		finding("setext-heading", "warning", file, item.number, underline + 1),
	];
}

/**
 * 最初の区切り線と違う流儀の区切り線を違反として返す
 *
 * @param item - 判定する本文の1行
 * @param previous - 直前の行
 * @param state - 最初の区切り線の流儀を保持する状態
 * @param file - 指摘に載せるfileのpath
 * @returns 流儀の混在の検出
 */
function thematicBreakFinding(
	item: MarkdownLine,
	previous: MarkdownLine | undefined,
	state: StyleState,
	file: string,
): Finding[] {
	if (!isThematicBreakLine(item.line, previous)) {
		return [];
	}
	const style = thematicBreakStyle(item.line);
	if (style === undefined) {
		return [];
	}
	if (state.style === undefined) {
		state.style = style;
		return [];
	}
	return style === state.style
		? []
		: [finding("thematic-break-style", "error", file, item.number, 1)];
}

/**
 * 最初のフェンスと違う記号のフェンスを違反として返す
 *
 * @param item - 判定するフェンス開始行
 * @param state - 最初のフェンスの記号を保持する状態
 * @param file - 指摘に載せるfileのpath
 * @returns フェンス記号の混在の検出
 */
function fenceStyleFinding(
	item: MarkdownLine,
	state: StyleState,
	file: string,
): Finding[] {
	const char = FENCE_MARKER.exec(item.line)?.[2]?.slice(0, 1);
	if (char === undefined) {
		return [];
	}
	if (state.style === undefined) {
		state.style = char;
		return [];
	}
	return char === state.style
		? []
		: [finding("fence-style", "error", file, item.number, 1)];
}

/**
 * 最初の強調と違う記号の強調を違反として返す
 *
 * @param item - 判定する本文の1行
 * @param masked - インラインコードを空白に置き換えた同じ行
 * @param state - 最初の強調記号を保持する状態
 * @param file - 指摘に載せるfileのpath
 * @returns 強調記号の混在の検出
 */
function emphasisMarkerFinding(
	item: MarkdownLine,
	masked: string,
	state: StyleState,
	file: string,
): Finding[] {
	const markers = emphasisMarkers(masked);
	if (markers.length === 0) {
		return [];
	}
	if (state.style === undefined) {
		state.style = markers[0]?.marker;
	}
	for (const marker of markers) {
		if (marker.marker !== state.style) {
			return [
				finding(
					"emphasis-marker",
					"error",
					file,
					item.number,
					marker.position + 1,
				),
			];
		}
	}
	return [];
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
	const breaks: StyleState = { style: undefined };
	const fences: StyleState = { style: undefined };
	const emphasis: StyleState = { style: undefined };
	const table: TableState = { columns: 0, rows: 0 };
	let ordered: OrderedState | undefined;
	for (let index = 0; index < items.length; index += 1) {
		const item = items[index];
		if (item === undefined) {
			continue;
		}
		const previous = items[index - 1];
		const next = items[index + 1];
		if (item.region !== "body") {
			blankStreak = 0;
			ordered = undefined;
			table.rows = 0;
			findings.push(
				...lintNonBodyLine(item, previous, next, enabled, fences, file),
			);
			continue;
		}
		findings.push(...tableColumnFinding(item, table, file));
		if (item.blank) {
			const blank = lintBlankLine(blankStreak, item, file);
			blankStreak = blank.streak;
			ordered = undefined;
			findings.push(...blank.findings);
			continue;
		}
		blankStreak = 0;
		const masked = maskInlineCode(item.line);
		findings.push(...lintBodyLine(item, file, enabled));
		findings.push(...indentedCodeFinding(items, index, file));
		findings.push(...headingJumpFinding(item, headings, file));
		findings.push(...setextHeadingFinding(item, previous, file));
		findings.push(...lintBlockLines(item, previous, next, file));
		findings.push(
			...lintStyleLines(
				item,
				masked,
				previous,
				enabled,
				breaks,
				emphasis,
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
	findings.push(...lintDocument(items, enabled, file));
	return findings.filter((finding) => !disabled.includes(finding.rule));
}

/**
 * 記号の内側の空白と裸のURLを取り除く
 *
 * @param line - 整形する本文の1行
 * @param disabled - 追加で無効にするruleの一覧
 * @returns 詰め物と裸のURLを除いた本文の1行
 */
function fixInlineSpacing(line: string, disabled: readonly RuleId[]): string {
	let result = line;
	if (!disabled.includes("bare-url")) {
		result = normalizeBareUrls(result);
	}
	if (!disabled.includes("emphasis-padding")) {
		result = normalizeEmphasisPadding(result);
	}
	if (!disabled.includes("code-span-padding")) {
		result = normalizeCodeSpanPadding(result);
	}
	if (!disabled.includes("link-label-padding")) {
		result = normalizeLinkLabelPadding(result);
	}
	return result;
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
	line = fixInlineSpacing(line, disabled);
	if (
		!disabled.includes("list-marker-space") &&
		findListMarkerSpace(line) !== undefined
	) {
		line = normalizeListMarkerSpace(line);
	}
	if (
		!disabled.includes("heading-indent") &&
		headingIndent(line) !== undefined
	) {
		line = normalizeHeadingIndent(line);
	}
	if (
		!disabled.includes("heading-space") &&
		headingSpaceColumn(line) !== undefined
	) {
		line = normalizeHeadingSpace(line);
	}
	if (!disabled.includes("trailing-whitespace")) {
		line = line.replace(/[ \t]+$/, "");
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
	line: string,
	previous: MarkdownLine | undefined,
	next: MarkdownLine | undefined,
	result: string[],
	fenceBlanks: boolean,
): boolean {
	if (fenceBlanks && blankBeforeFence(item, previous)) {
		result.push("");
	}
	result.push(line);
	if (fenceBlanks && blankAfterFence(item, next)) {
		result.push("");
		return true;
	}
	return false;
}

/**
 * 前後に空行を補う塊の指定
 */
interface BlankBlocks {
	heading: boolean;
	list: boolean;
	table: boolean;
}

/**
 * 塊の開始行の前に空行を補うか判定する
 *
 * @param line - 判定する本文の1行
 * @param previous - 直前の行
 * @param blocks - 前後に空行を補う塊の指定
 * @returns 空行を補うならtrue
 */
function needsBlankBefore(
	line: string,
	previous: MarkdownLine | undefined,
	blocks: BlankBlocks,
): boolean {
	return (
		(blocks.heading && blankBeforeBlock(line, previous, isHeadingLine)) ||
		(blocks.list && blankBeforeBlock(line, previous, isListBlock)) ||
		(blocks.table && blankBeforeBlock(line, previous, isTableRow))
	);
}

/**
 * 塊の終了行の後に空行を補うか判定する
 *
 * @param line - 判定する本文の1行
 * @param next - 次の行
 * @param blocks - 前後に空行を補う塊の指定
 * @returns 空行を補うならtrue
 */
function needsBlankAfter(
	line: string,
	next: MarkdownLine | undefined,
	blocks: BlankBlocks,
): boolean {
	return (
		(blocks.heading && blankAfterBlock(line, next, isHeadingLine)) ||
		(blocks.list && blankAfterBlock(line, next, isListBlock)) ||
		(blocks.table && blankAfterBlock(line, next, isTableRow))
	);
}

/**
 * 本文行を結果へ積み 塊の前後の空行を補う
 *
 * @param line - 積む本文の1行
 * @param previous - 直前の行
 * @param next - 次の行
 * @param result - 積み先の行一覧
 * @param blocks - 前後に空行を補う塊の指定
 * @param keepConsecutive - 連続空行をそのまま積むか
 * @returns 積んだ末尾が空行ならtrue
 */
function pushBodyLine(
	line: string,
	previous: MarkdownLine | undefined,
	next: MarkdownLine | undefined,
	result: string[],
	blocks: BlankBlocks,
	keepConsecutive: boolean,
): boolean {
	if (needsBlankBefore(line, previous, blocks)) {
		appendBlankLine(result, keepConsecutive, result[result.length - 1] === "");
	}
	result.push(line);
	if (needsBlankAfter(line, next, blocks)) {
		result.push("");
		return true;
	}
	return false;
}

/**
 * 最初のフェンスと同じ記号へフェンス行を揃える
 *
 * @param item - 揃える行
 * @param state - 最初のフェンスの記号を保持する状態
 * @param enabled - フェンス記号を揃えるか
 * @returns 記号を揃えた行
 */
function alignFenceLine(
	item: MarkdownLine,
	state: StyleState,
	enabled: boolean,
): string {
	if (
		!enabled ||
		(item.region !== "fence-open" && item.region !== "fence-close")
	) {
		return item.line;
	}
	const match = FENCE_MARKER.exec(item.line);
	if (match === null) {
		return item.line;
	}
	const marker = match[2] ?? "";
	const char = marker.slice(0, 1);
	if (state.style === undefined) {
		state.style = char;
		return item.line;
	}
	if (char === state.style) {
		return item.line;
	}
	return `${match[1] ?? ""}${state.style.repeat(marker.length)}${item.line.slice(match[0].length)}`;
}

/**
 * 最初の区切り線と同じ流儀へ区切り線を揃える
 *
 * @param line - 揃える本文の1行
 * @param previous - 直前の行
 * @param state - 最初の区切り線の流儀を保持する状態
 * @param enabled - 区切り線を揃えるか
 * @returns 流儀を揃えた本文の1行
 */
function alignThematicBreak(
	line: string,
	previous: MarkdownLine | undefined,
	state: StyleState,
	enabled: boolean,
): string {
	if (!enabled || !isThematicBreakLine(line, previous)) {
		return line;
	}
	const style = thematicBreakStyle(line);
	if (style === undefined) {
		return line;
	}
	if (state.style === undefined) {
		state.style = style;
		return line;
	}
	if (style === state.style) {
		return line;
	}
	const indent = /^\s*/.exec(line)?.[0] ?? "";
	return `${indent}${state.style}`;
}

/**
 * 最初の強調と同じ記号へ強調記号を揃える
 *
 * @param line - 揃える本文の1行
 * @param state - 最初の強調記号を保持する状態
 * @param enabled - 強調記号を揃えるか
 * @returns 記号を揃えた本文の1行
 */
function alignEmphasisLine(
	line: string,
	state: StyleState,
	enabled: boolean,
): string {
	if (!enabled) {
		return line;
	}
	const markers = emphasisMarkers(maskInlineCode(line));
	if (markers.length === 0) {
		return line;
	}
	if (state.style === undefined) {
		state.style = markers[0]?.marker;
	}
	const style = state.style;
	if (style === undefined) {
		return line;
	}
	return markers.some((marker) => marker.marker !== style)
		? alignEmphasisMarker(line, style)
		: line;
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
	const fences: StyleState = { style: undefined };
	const breaks: StyleState = { style: undefined };
	const emphasis: StyleState = { style: undefined };
	const consistentMarkers =
		enabled.includes("list-marker-consistency") &&
		!disabled.includes("list-marker-consistency");
	const optIn = (rule: OptInRuleId): boolean =>
		enabled.includes(rule) && !disabled.includes(rule);
	const fenceBlanks = !disabled.includes("fence-blank-lines");
	const keepConsecutive = disabled.includes("consecutive-blank-lines");
	const blocks: BlankBlocks = {
		heading: !disabled.includes("heading-blank-lines"),
		list: !disabled.includes("list-blank-lines"),
		table: !disabled.includes("table-blank-lines"),
	};
	for (let index = 0; index < items.length; index += 1) {
		const item = items[index];
		if (item === undefined) {
			continue;
		}
		const previous = items[index - 1];
		const next = items[index + 1];
		if (item.region !== "body") {
			previousBlank = pushNonBodyLine(
				item,
				alignFenceLine(item, fences, optIn("fence-style")),
				previous,
				next,
				result,
				fenceBlanks,
			);
			continue;
		}
		const fixed = alignEmphasisLine(
			alignThematicBreak(
				alignMarkerLine(fixLine(item, disabled), markers, consistentMarkers),
				previous,
				breaks,
				optIn("thematic-break-style"),
			),
			emphasis,
			optIn("emphasis-marker"),
		);
		if (fixed === "") {
			appendBlankLine(result, keepConsecutive, previousBlank);
			previousBlank = true;
			continue;
		}
		previousBlank = pushBodyLine(
			fixed,
			previous,
			next,
			result,
			blocks,
			keepConsecutive,
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
