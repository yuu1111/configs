/**
 * code-style-checkが報告するruleの識別子一覧
 */
export const RULE_IDS = [
	"blank-line-between-class-members",
	"blank-line-between-definitions",
] as const;

/**
 * RULE_IDSが定義するrule識別子のunion型
 */
export type RuleId = (typeof RULE_IDS)[number];

/**
 * 既定では実行せず--enableで明示的に有効にするruleの識別子一覧 このengineは空にする
 */
export const OPT_IN_RULE_IDS = [] as const;

/**
 * ruleをgroupへまとめた対応表 `rules` のgroup単位の指定が使う
 */
export const RULE_GROUPS = {
	spacing: [
		"blank-line-between-class-members",
		"blank-line-between-definitions",
	],
} as const satisfies Record<string, readonly RuleId[]>;
