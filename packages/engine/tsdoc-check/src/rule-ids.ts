/**
 * 抑制commentと--errorで指定できるrule名の一覧
 */
export const KNOWN_RULE_NAMES = [
	"blank-line-before-tags",
	"deprecated-without-guidance",
	"missing-doc",
	"missing-returns",
	"param-mismatch",
	"param-order",
	"param-untagged",
	"single-line-doc",
	"suppression",
	"suppression-unused",
	"tsdoc-syntax",
	"tsdoc-tag",
	"type-param-mismatch",
	"type-param-untagged",
] as const;

/**
 * KNOWN_RULE_NAMESが定義するrule識別子のunion型
 */
export type TsdocRule = (typeof KNOWN_RULE_NAMES)[number];

/**
 * 既定では実行せず--enableで明示的に有効にするruleの識別子一覧
 */
export const OPT_IN_RULE_IDS = [
	"deprecated-without-guidance",
	"missing-returns",
	"param-order",
] as const;

/**
 * OPT_IN_RULE_IDSが定義するrule識別子のunion型
 */
export type OptInRuleId = (typeof OPT_IN_RULE_IDS)[number];

/**
 * ruleをgroupへまとめた対応表 `rules` のgroup単位の指定が使う
 */
export const RULE_GROUPS = {
	syntax: [
		"blank-line-before-tags",
		"single-line-doc",
		"tsdoc-syntax",
		"tsdoc-tag",
	],
	documentation: [
		"deprecated-without-guidance",
		"missing-doc",
		"missing-returns",
	],
	contract: [
		"param-mismatch",
		"param-order",
		"param-untagged",
		"type-param-mismatch",
		"type-param-untagged",
	],
	suppression: ["suppression", "suppression-unused"],
} as const satisfies Record<string, readonly TsdocRule[]>;
