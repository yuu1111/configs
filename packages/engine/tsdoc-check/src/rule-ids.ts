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
	"blank-line-before-tags",
	"deprecated-without-guidance",
	"missing-doc",
	"missing-returns",
	"param-order",
	"param-untagged",
	"single-line-doc",
	"type-param-untagged",
] as const;

/**
 * OPT_IN_RULE_IDSが定義するrule識別子のunion型
 */
export type OptInRuleId = (typeof OPT_IN_RULE_IDS)[number];

/**
 * tsdoc-checkが検査するfileの拡張子
 */
export const FILE_EXTENSIONS = [".cts", ".mts", ".ts", ".tsx"] as const;

/**
 * ruleが検査する宣言の広さ
 *
 * - exported — 公開surfaceの宣言だけを対象にする
 * - documented — 上に加えて docがある宣言すべてを対象にする `missing-doc` は取らない
 * - all — 関数本体の外にある宣言すべてへdocを要求する `missing-doc` だけが取る
 */
export const SCOPES = ["exported", "documented", "all"] as const;

/**
 * SCOPESが定義するscopeのunion型
 */
export type Scope = (typeof SCOPES)[number];

/**
 * scopeの既定値 公開surfaceだけを対象にする
 */
export const DEFAULT_SCOPE: Scope = "exported";

/**
 * ruleが受け取るoptionとその選択肢 ここに無いruleは書かれたTSDocが正しいかだけを見て docがある宣言すべてを対象にする
 */
export const RULE_OPTIONS = {
	"blank-line-before-tags": { scope: SCOPES },
	"deprecated-without-guidance": { scope: SCOPES },
	"missing-doc": { scope: ["exported", "all"] },
	"missing-returns": { scope: SCOPES },
	"param-order": { scope: SCOPES },
	"param-untagged": { scope: SCOPES },
	"single-line-doc": { scope: SCOPES },
	"type-param-untagged": { scope: SCOPES },
} as const satisfies Partial<Record<RuleId, Record<string, readonly string[]>>>;

/**
 * ruleごとのscopeの指定 省略したruleは既定のscopeになる
 */
export type RuleScopes = Partial<Record<RuleId, Scope>>;

/**
 * 統合runnerが渡すruleごとのoptionからscopeだけを読む 不正な値は既定値へ倒す
 *
 * @param options - ruleごとのoption
 * @returns ruleごとのscope
 */
export function readRuleScopes(
	options:
		| Readonly<Record<string, Readonly<Record<string, string>>>>
		| undefined,
): RuleScopes {
	const scopes: RuleScopes = {};
	for (const rule of Object.keys(
		RULE_OPTIONS,
	) as (keyof typeof RULE_OPTIONS)[]) {
		const value = options?.[rule]?.scope;
		if ((RULE_OPTIONS[rule].scope as readonly string[]).includes(value ?? "")) {
			scopes[rule] = value as Scope;
		}
	}
	return scopes;
}

/**
 * ruleをgroupへまとめた対応表 `rules` のgroup単位の指定が使う
 */
export const RULE_GROUPS = {
	correctness: [
		"orphan-doc",
		"param-mismatch",
		"tsdoc-syntax",
		"tsdoc-tag",
		"type-param-mismatch",
	],
	suppression: ["suppression", "suppression-unused"],
	completeness: [
		"deprecated-without-guidance",
		"missing-doc",
		"missing-returns",
		"param-order",
		"param-untagged",
		"type-param-untagged",
	],
	style: ["blank-line-before-tags", "single-line-doc"],
} as const satisfies Record<string, readonly RuleId[]>;
