/**
 * document-style-checkが報告するruleの識別子一覧
 */
export const RULE_IDS = [
	"code-fence-language",
	"consecutive-blank-lines",
	"date-anchored-statement",
	"empty-link",
	"full-width-alphanumeric",
	"hard-break-html",
	"heading-level-jump",
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
