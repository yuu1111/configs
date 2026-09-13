/**
 * 抑制commentと--errorで指定できるrule名の一覧
 */
export const KNOWN_RULE_NAMES = [
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
