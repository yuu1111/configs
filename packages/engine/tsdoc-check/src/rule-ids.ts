/**
 * tsdoc-checkが報告するruleの識別子一覧
 */
export const RULE_IDS = [
	"blank-line-before-tags",
	"deprecated-without-guidance",
	"missing-doc",
	"missing-returns",
	"orphan-doc",
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
 * RULE_IDSが定義するrule識別子のunion型
 */
export type RuleId = (typeof RULE_IDS)[number];

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
 * 検査する宣言をどこまで広げるか
 */
export const DOC_SCOPES = ["exported", "documented", "all"] as const;

/**
 * DOC_SCOPESが定義するdocScopeのunion型
 */
export type DocScope = (typeof DOC_SCOPES)[number];

/**
 * docScopeの既定値 公開契約だけを対象にする
 */
export const DEFAULT_DOC_SCOPE: DocScope = "exported";

/**
 * docScopeに従って対象を選ぶrule 文書の不足を決めるruleがここに入る
 *
 * この一覧に無いruleは書かれたTSDocが正しいかだけを見て docがある宣言すべてを対象にする
 *
 * - exported — 公開surfaceの宣言だけを対象にする
 * - documented — 上に加えて doc がある宣言すべてを対象にする
 * - all — 上に加えて 関数本体の外にある宣言すべてへdocを要求する
 */
export const SCOPED_RULE_IDS: readonly RuleId[] = [
	"deprecated-without-guidance",
	"missing-doc",
	"missing-returns",
	"param-order",
	"param-untagged",
	"type-param-untagged",
];

/**
 * 書いたTSDocの体裁をどこまで検査するか
 */
export const STYLE_SCOPES = ["exported", "documented"] as const;

/**
 * STYLE_SCOPESが定義するstyleScopeのunion型
 */
export type StyleScope = (typeof STYLE_SCOPES)[number];

/**
 * styleScopeの既定値 公開surfaceだけを対象にする
 */
export const DEFAULT_STYLE_SCOPE: StyleScope = "exported";

/**
 * styleScopeに従って対象を選ぶrule 書いたTSDocの書き方を決めるruleがここに入る
 *
 * - exported — 公開surfaceの宣言だけを対象にする
 * - documented — docがある宣言すべてを対象にする
 */
export const STYLE_RULE_IDS: readonly RuleId[] = [
	"blank-line-before-tags",
	"single-line-doc",
];

/**
 * ruleをgroupへまとめた対応表 `rules` のgroup単位の指定が使う
 */
export const RULE_GROUPS = {
	syntax: [
		"blank-line-before-tags",
		"orphan-doc",
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
} as const satisfies Record<string, readonly RuleId[]>;
