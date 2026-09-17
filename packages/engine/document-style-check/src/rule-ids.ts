/**
 * document-style-checkが報告するruleの識別子一覧
 */
export const RULE_IDS = [
	"code-fence-language",
	"consecutive-blank-lines",
	"date-anchored-statement",
	"empty-link",
	"fence-blank-lines",
	"full-width-alphanumeric",
	"hard-break-html",
	"hard-tabs",
	"heading-level-jump",
	"heading-space",
	"heading-trailing-punctuation",
	"japanese-comma",
	"japanese-period",
	"list-blank-lines",
	"list-marker-consistency",
	"ordered-list-marker",
	"reversed-link",
	"single-trailing-newline",
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
	"ordered-list-marker",
] as const;

/**
 * OPT_IN_RULE_IDSが定義するrule識別子のunion型
 */
export type OptInRuleId = (typeof OPT_IN_RULE_IDS)[number];

/**
 * ruleをgroupへまとめた対応表 `rules` のgroup単位の指定が使う
 */
export const RULE_GROUPS = {
	whitespace: [
		"consecutive-blank-lines",
		"hard-break-html",
		"hard-tabs",
		"single-trailing-newline",
		"trailing-backslash",
		"trailing-whitespace",
	],
	typography: ["full-width-alphanumeric", "japanese-comma", "japanese-period"],
	structure: [
		"code-fence-language",
		"fence-blank-lines",
		"heading-level-jump",
		"heading-space",
		"heading-trailing-punctuation",
		"list-blank-lines",
		"list-marker-consistency",
		"ordered-list-marker",
	],
	content: ["date-anchored-statement", "empty-link", "reversed-link"],
} as const satisfies Record<string, readonly RuleId[]>;
