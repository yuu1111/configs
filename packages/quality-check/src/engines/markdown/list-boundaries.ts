import { fromMarkdown } from "mdast-util-from-markdown";
import type { MarkdownLine } from "./audit";

/**
 * リストの前後で空行が不足している行番号
 */
export interface ListBlankLines {
	after: Set<number>;
	before: Set<number>;
}

/**
 * 本文の最上位リストから前後の空行不足を求める
 *
 * @param source - 解析するMarkdownの本文文字列
 * @param items - 本文の領域と行番号の一覧
 * @returns リスト開始行の前と終了行の後に空行が必要な行番号
 */
export function listBlankLines(
	source: string,
	items: readonly MarkdownLine[],
): ListBlankLines {
	// frontmatterの内容が本文のリストへ連結しないよう、行数を保って除く
	const body = items.some((item) => item.region === "frontmatter")
		? items
				.map((item) => (item.region === "frontmatter" ? "" : item.line))
				.join("\n")
		: source;
	const ranges = fromMarkdown(body).children.flatMap((node) => {
		if (node.type !== "list" || node.position === undefined) {
			return [];
		}
		const start = node.position.start.line;
		const end = node.position.end.line;
		return items[start - 1]?.region === "body" ? [{ end, start }] : [];
	});
	const starts = new Set(ranges.map((range) => range.start));
	const ends = new Set(ranges.map((range) => range.end));
	const before = new Set<number>();
	const after = new Set<number>();
	for (const { end, start } of ranges) {
		const previous = items[start - 2];
		const next = items[end];
		if (
			previous?.region === "body" &&
			!previous.blank &&
			!ends.has(previous.number)
		) {
			before.add(start);
		}
		if (next?.region === "body" && !next.blank && !starts.has(next.number)) {
			after.add(end);
		}
	}
	return { after, before };
}
