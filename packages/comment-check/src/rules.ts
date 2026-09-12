import type { Located } from "@yuu1111/shared/findings";

/**
 * comment-checkが報告するruleの識別子一覧
 */
export const RULE_IDS = [
	"broad-suppression",
	"undocumented-directive",
	"placeholder-comment",
	"separator-comment",
	"japanese-period",
] as const;

/**
 * RULE_IDSが定義するrule識別子のunion型
 */
export type RuleId = (typeof RULE_IDS)[number];

/**
 * 既定では実行せず--enableで明示的に有効にするruleの識別子一覧
 */
export const OPT_IN_RULE_IDS = ["japanese-period"] as const;

/**
 * OPT_IN_RULE_IDSが定義するrule識別子のunion型
 */
export type OptInRuleId = (typeof OPT_IN_RULE_IDS)[number];

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
const JAPANESE_PERIOD = "。";

/**
 * --enableの値を検証して重複を除く 未知のrule名は設定errorにする
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
 * comment原文にある最初の日本語句点の位置を返す 無ければ-1を返す
 */
export function findJapanesePeriod(text: string): number {
	return text.indexOf(JAPANESE_PERIOD);
}

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
