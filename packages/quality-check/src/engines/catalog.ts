import {
	FILE_EXTENSIONS as CODE_FILE_EXTENSIONS,
	OPT_IN_RULE_IDS as CODE_OPT_IN_RULE_IDS,
	RULE_GROUPS as CODE_RULE_GROUPS,
	RULE_IDS as CODE_RULE_IDS,
} from "./code/rule-ids";
import {
	FILE_EXTENSIONS as COMMENT_FILE_EXTENSIONS,
	OPT_IN_RULE_IDS as COMMENT_OPT_IN_RULE_IDS,
	RULE_GROUPS as COMMENT_RULE_GROUPS,
	RULE_IDS as COMMENT_RULE_IDS,
} from "./comment/rule-ids";
import {
	FILE_EXTENSIONS as MARKDOWN_FILE_EXTENSIONS,
	OPT_IN_RULE_IDS as MARKDOWN_OPT_IN_RULE_IDS,
	RULE_GROUPS as MARKDOWN_RULE_GROUPS,
	RULE_IDS as MARKDOWN_RULE_IDS,
} from "./markdown/rule-ids";
import {
	FILE_EXTENSIONS as TSDOC_FILE_EXTENSIONS,
	OPT_IN_RULE_IDS as TSDOC_OPT_IN_RULE_IDS,
	RULE_GROUPS as TSDOC_RULE_GROUPS,
	RULE_IDS as TSDOC_RULE_IDS,
	RULE_OPTIONS as TSDOC_RULE_OPTIONS,
} from "./tsdoc/rule-ids";

/**
 * 子プロセスで起動するengineの名前
 */
export const PROCESS_ENGINE_NAMES = [
	"biome",
	"oxlint",
	"oxfmt",
	"typecheck",
	"knip",
] as const;

/**
 * 子プロセスengine名のunion型
 */
export type ProcessEngineName = (typeof PROCESS_ENGINE_NAMES)[number];

/**
 * in-processで起動するengineの名前
 */
export const FINDING_ENGINE_NAMES = [
	"code",
	"comment",
	"markdown",
	"tsdoc",
] as const;

/**
 * 検出engine名のunion型
 */
export type FindingEngineName = (typeof FINDING_ENGINE_NAMES)[number];

/**
 * 統合CLIが起動するengineの名前 並び順が実行順になる
 */
export const ENGINE_NAMES = [
	...PROCESS_ENGINE_NAMES,
	...FINDING_ENGINE_NAMES,
] as const;

/**
 * engine名のunion型
 */
export type EngineName = (typeof ENGINE_NAMES)[number];

/**
 * engineが公開するrule語彙
 */
export interface EngineVocabulary {
	/**
	 * engineが知る全rule
	 */
	all: readonly string[];

	/**
	 * engineが検査するfileの拡張子
	 */
	extensions: readonly string[];

	/**
	 * ruleをまとめたgroup
	 */
	groups: Record<string, readonly string[]>;

	/**
	 * 既定で実行しないrule
	 */
	optIn: readonly string[];

	/**
	 * ruleごとに受け取るoptionとその選択肢 受け取るruleが無ければundefined
	 */
	ruleOptions?: Partial<Record<string, Record<string, readonly string[]>>>;
}

/**
 * engineが公開するrule語彙 engineのrule-idsが唯一の出所になる
 */
export const RULE_VOCABULARY = {
	code: {
		all: CODE_RULE_IDS,
		extensions: CODE_FILE_EXTENSIONS,
		groups: CODE_RULE_GROUPS,
		optIn: CODE_OPT_IN_RULE_IDS,
	},
	comment: {
		all: COMMENT_RULE_IDS,
		extensions: COMMENT_FILE_EXTENSIONS,
		groups: COMMENT_RULE_GROUPS,
		optIn: COMMENT_OPT_IN_RULE_IDS,
	},
	markdown: {
		all: MARKDOWN_RULE_IDS,
		extensions: MARKDOWN_FILE_EXTENSIONS,
		groups: MARKDOWN_RULE_GROUPS,
		optIn: MARKDOWN_OPT_IN_RULE_IDS,
	},
	tsdoc: {
		all: TSDOC_RULE_IDS,
		extensions: TSDOC_FILE_EXTENSIONS,
		groups: TSDOC_RULE_GROUPS,
		optIn: TSDOC_OPT_IN_RULE_IDS,
		ruleOptions: TSDOC_RULE_OPTIONS,
	},
} satisfies Record<string, EngineVocabulary>;

/**
 * rule語彙を受け取るengine名のunion型
 */
export type RuleEngineName = keyof typeof RULE_VOCABULARY;

/**
 * engineがrule語彙を受け取るか
 *
 * @param name - 判定するengine名
 * @returns rule語彙を受け取るengineならtrue
 */
export function isRuleEngine(name: EngineName): name is RuleEngineName {
	return name in RULE_VOCABULARY;
}

/**
 * engineが受け取るruleごとのoptionとその選択肢を返す
 *
 * @param name - 語彙を引くengine名
 * @returns rule名ごとのoptionとその選択肢 受け取るruleが無ければ空
 */
export function ruleOptionsOf(
	name: RuleEngineName,
): Partial<Record<string, Record<string, readonly string[]>>> {
	return (RULE_VOCABULARY[name] as EngineVocabulary).ruleOptions ?? {};
}

/**
 * engineが受け取る検出と起動条件
 */
export interface EngineCapabilities {
	/**
	 * 追加の引数を受け取るか 受け取るengineは子プロセスで起動する
	 */
	args: boolean;

	/**
	 * 検出を返し baseline の対象になるか 検出engineはin-processで起動する
	 */
	findings: boolean;

	/**
	 * 受け取らない起動条件とその理由 受け取るときは undefined
	 */
	skipped: Partial<Record<"ignore" | "targets", string>>;
}

/**
 * engine名ごとの能力 受け取る起動条件と検出の唯一の出所
 */
export const ENGINE_CAPABILITIES: Record<EngineName, EngineCapabilities> = {
	biome: {
		args: true,
		findings: false,
		skipped: { ignore: "biome.json holds its settings" },
	},
	oxlint: { args: true, findings: false, skipped: {} },
	oxfmt: {
		args: true,
		findings: false,
		skipped: { ignore: ".oxfmtrc.json and ignore files hold its settings" },
	},
	typecheck: {
		args: true,
		findings: false,
		skipped: {
			ignore: "tsconfig.json holds its settings",
			targets: "tsconfig.json and projects hold its settings",
		},
	},
	knip: {
		args: true,
		findings: false,
		skipped: {
			ignore: "knip.ts holds its settings",
			targets: "knip analyzes the whole project",
		},
	},
	code: { args: false, findings: true, skipped: {} },
	comment: { args: false, findings: true, skipped: {} },
	markdown: { args: false, findings: true, skipped: {} },
	tsdoc: { args: false, findings: true, skipped: {} },
};
