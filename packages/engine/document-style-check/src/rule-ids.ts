/**
 * document-style-checkが報告するruleの識別子一覧
 */
export const RULE_IDS = [
	"bare-url",
	"code-fence-language",
	"code-span-padding",
	"consecutive-blank-lines",
	"date-anchored-statement",
	"descriptive-link-text",
	"emphasis-as-heading",
	"emphasis-marker",
	"emphasis-padding",
	"empty-link",
	"fence-blank-lines",
	"fence-style",
	"first-line-heading",
	"full-width-alphanumeric",
	"hard-break-html",
	"hard-tabs",
	"heading-blank-lines",
	"heading-indent",
	"heading-level-jump",
	"heading-space",
	"heading-trailing-punctuation",
	"indented-code-block",
	"japanese-comma",
	"japanese-period",
	"link-label-padding",
	"list-blank-lines",
	"list-marker-consistency",
	"list-marker-space",
	"ordered-list-marker",
	"reversed-link",
	"setext-heading",
	"single-top-level-heading",
	"single-trailing-newline",
	"table-blank-lines",
	"table-column-count",
	"thematic-break-style",
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
	"emphasis-marker",
	"fence-style",
	"first-line-heading",
	"full-width-alphanumeric",
	"japanese-comma",
	"japanese-period",
	"list-marker-consistency",
	"ordered-list-marker",
	"single-top-level-heading",
	"thematic-break-style",
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
		"code-span-padding",
		"consecutive-blank-lines",
		"emphasis-padding",
		"hard-break-html",
		"hard-tabs",
		"link-label-padding",
		"single-trailing-newline",
		"trailing-backslash",
		"trailing-whitespace",
	],
	typography: [
		"emphasis-marker",
		"full-width-alphanumeric",
		"japanese-comma",
		"japanese-period",
	],
	structure: [
		"code-fence-language",
		"emphasis-as-heading",
		"fence-blank-lines",
		"fence-style",
		"first-line-heading",
		"heading-blank-lines",
		"heading-indent",
		"heading-level-jump",
		"heading-space",
		"heading-trailing-punctuation",
		"indented-code-block",
		"list-blank-lines",
		"list-marker-consistency",
		"list-marker-space",
		"ordered-list-marker",
		"setext-heading",
		"single-top-level-heading",
		"table-blank-lines",
		"table-column-count",
		"thematic-break-style",
	],
	content: [
		"bare-url",
		"date-anchored-statement",
		"descriptive-link-text",
		"empty-link",
		"reversed-link",
	],
} as const satisfies Record<string, readonly RuleId[]>;
