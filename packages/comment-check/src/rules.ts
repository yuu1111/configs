import type { Located } from "@yuu1111/shared/findings";

/**
 * comment-checkが報告するruleの識別子一覧
 */
export const RULE_IDS = [
	"broad-suppression",
	"undocumented-directive",
	"placeholder-comment",
	"separator-comment",
] as const;

/**
 * RULE_IDSが定義するrule識別子のunion型
 */
export type RuleId = (typeof RULE_IDS)[number];

/**
 * 検出したcomment違反1件の内容と位置
 */
export interface Finding extends Located {
	rule: RuleId;
	text: string;
}

const PLACEHOLDER_PATTERN = /\b(TODO|FIXME|XXX|HACK)\b/;
const SEPARATOR_PATTERN = /^[-=*_#~+./\\|]{4,}$/;
const DIRECTIVE_PATTERN = /^@ts-(?:ignore|expect-error)\b([\s\S]*)$/;

/**
 * block commentの記号を除いて空白を揃えた本文を返す
 */
export function normalizeComment(body: string): string {
	return body
		.split("\n")
		.map((line) => line.replace(/^\s*\*+\s?/, ""))
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * comment本文を分類し、該当するruleがなければnullを返す
 */
export function classifyComment(body: string): RuleId | null {
	const text = normalizeComment(body);
	if (text === "") {
		return null;
	}
	if (
		/^(?:biome-ignore-all|@ts-nocheck)\b/.test(text) ||
		/^eslint-disable(?:-next-line|-line)?\s*$/.test(text)
	) {
		return "broad-suppression";
	}
	const directive = DIRECTIVE_PATTERN.exec(text);
	if (directive) {
		return (directive[1] ?? "").replace(/^[\s:—-]+/, "") === ""
			? "undocumented-directive"
			: null;
	}
	if (PLACEHOLDER_PATTERN.test(text)) {
		return "placeholder-comment";
	}
	if (SEPARATOR_PATTERN.test(text)) {
		return "separator-comment";
	}
	return null;
}
