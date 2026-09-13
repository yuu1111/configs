/**
 * comment-checkが報告するruleの識別子一覧
 */
export const RULE_IDS = [
	"broad-suppression",
	"cramped-comment",
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
export const OPT_IN_RULE_IDS = ["cramped-comment", "japanese-period"] as const;

/**
 * OPT_IN_RULE_IDSが定義するrule識別子のunion型
 */
export type OptInRuleId = (typeof OPT_IN_RULE_IDS)[number];

/**
 * ruleをgroupへまとめた対応表 `rules` のgroup単位の指定が使う
 */
export const RULE_GROUPS = {
	suppression: ["broad-suppression", "undocumented-directive"],
	shape: ["cramped-comment", "separator-comment"],
	content: ["placeholder-comment", "japanese-period"],
} as const satisfies Record<string, readonly RuleId[]>;
