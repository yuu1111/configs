import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	OPT_IN_RULE_IDS as CODE_STYLE_CHECK_OPT_IN_RULE_IDS,
	RULE_GROUPS as CODE_STYLE_CHECK_RULE_GROUPS,
	RULE_IDS as CODE_STYLE_CHECK_RULE_IDS,
} from "@yuu1111/code-style-check/rule-ids";
import {
	OPT_IN_RULE_IDS as COMMENT_CHECK_OPT_IN_RULE_IDS,
	RULE_GROUPS as COMMENT_CHECK_RULE_GROUPS,
	RULE_IDS as COMMENT_CHECK_RULE_IDS,
} from "@yuu1111/comment-check/rule-ids";
import {
	OPT_IN_RULE_IDS as DOCUMENT_STYLE_CHECK_OPT_IN_RULE_IDS,
	RULE_GROUPS as DOCUMENT_STYLE_CHECK_RULE_GROUPS,
	RULE_IDS as DOCUMENT_STYLE_CHECK_RULE_IDS,
} from "@yuu1111/document-style-check/rule-ids";
import type { RuleSelection } from "@yuu1111/shared/engines";
import {
	DEFAULT_DOC_SCOPE as TSDOC_CHECK_DEFAULT_DOC_SCOPE,
	DEFAULT_STYLE_SCOPE as TSDOC_CHECK_DEFAULT_STYLE_SCOPE,
	DOC_SCOPES as TSDOC_CHECK_DOC_SCOPES,
	OPT_IN_RULE_IDS as TSDOC_CHECK_OPT_IN_RULE_IDS,
	RULE_GROUPS as TSDOC_CHECK_RULE_GROUPS,
	RULE_IDS as TSDOC_CHECK_RULE_IDS,
	STYLE_SCOPES as TSDOC_CHECK_STYLE_SCOPES,
} from "@yuu1111/tsdoc-check/rule-ids";

/**
 * 子プロセスで起動するengineの名前
 */
export const PROCESS_ENGINE_NAMES = ["biome", "typecheck", "knip"] as const;

/**
 * 子プロセスengine名のunion型
 */
export type ProcessEngineName = (typeof PROCESS_ENGINE_NAMES)[number];

/**
 * in-processで起動するengineの名前
 */
export const FINDING_ENGINE_NAMES = [
	"code-style-check",
	"comment-check",
	"document-style-check",
	"tsdoc-check",
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
 * rule1つ分の状態 offで無効 onでengineの既定 errorで違反として扱う
 */
export type RuleState = "off" | "on" | "error";

/**
 * engineへ渡す起動条件
 */
export interface EngineOptions {
	/**
	 * engineの既定引数の後ろへ足す引数
	 */
	args: string[];

	/**
	 * 検査から外すpath
	 */
	ignore: string[];

	/**
	 * 検査する対象path
	 */
	targets: string[];
}

/**
 * 型検査へ渡す起動条件
 */
export interface TypecheckOptions extends EngineOptions {
	/**
	 * 型検査するtsconfigのpath
	 */
	projects: string[];
}

/**
 * 検出engineへ渡す起動条件 検出engineはin-processで走るため追加の引数は持たない
 */
export interface RuleEngineOptions {
	/**
	 * 検査から外すpath
	 */
	ignore: string[];

	/**
	 * engineごとの追加option 統合runnerが検証して渡す
	 */
	options: Record<string, unknown>;

	/**
	 * 展開済みのrule選択
	 */
	rules: RuleSelection;

	/**
	 * 検査する対象path
	 */
	targets: string[];
}

/**
 * engine名ごとの起動条件
 */
export interface EngineConfigMap {
	biome: EngineOptions;
	typecheck: TypecheckOptions;
	knip: EngineOptions;
	"code-style-check": RuleEngineOptions;
	"comment-check": RuleEngineOptions;
	"document-style-check": RuleEngineOptions;
	"tsdoc-check": RuleEngineOptions;
}

/**
 * quality.jsonが表す統合検査の設定
 */
export interface QualityConfig {
	/**
	 * 起動するengine 値がfalseのengineは起動しない
	 */
	engines: Partial<Record<EngineName, boolean>>;

	/**
	 * engineごとの起動条件
	 */
	config: Partial<EngineConfigMap>;

	/**
	 * warningを阻害する検出として扱うか
	 */
	failOnWarnings: boolean;

	/**
	 * baseline fileのpath falseなら差分判定を行わない
	 */
	baseline: string | false;
}

/**
 * engineが公開するrule語彙
 */
interface EngineVocabulary {
	/**
	 * engineが知る全rule
	 */
	all: readonly string[];

	/**
	 * ruleをまとめたgroup
	 */
	groups: Record<string, readonly string[]>;

	/**
	 * 既定で実行しないrule
	 */
	optIn: readonly string[];

	/**
	 * 検査する宣言を文書の広さで選ぶengineが受け取るdocScopeの一覧 受け取らなければundefined
	 */
	docScopes?: readonly string[];

	/**
	 * 書いたTSDocの体裁を検査する宣言を選ぶengineが受け取るstyleScopeの一覧 受け取らなければundefined
	 */
	styleScopes?: readonly string[];

	/**
	 * ruleを違反へ上げられるか
	 */
	promotes: boolean;
}

/**
 * engineが公開するrule語彙 engineのrule-idsが唯一の出所になる
 */
export const RULE_VOCABULARY = {
	"code-style-check": {
		all: CODE_STYLE_CHECK_RULE_IDS,
		groups: CODE_STYLE_CHECK_RULE_GROUPS,
		optIn: CODE_STYLE_CHECK_OPT_IN_RULE_IDS,
		promotes: false,
	},
	"comment-check": {
		all: COMMENT_CHECK_RULE_IDS,
		groups: COMMENT_CHECK_RULE_GROUPS,
		optIn: COMMENT_CHECK_OPT_IN_RULE_IDS,
		promotes: false,
	},
	"document-style-check": {
		all: DOCUMENT_STYLE_CHECK_RULE_IDS,
		groups: DOCUMENT_STYLE_CHECK_RULE_GROUPS,
		optIn: DOCUMENT_STYLE_CHECK_OPT_IN_RULE_IDS,
		promotes: false,
	},
	"tsdoc-check": {
		all: TSDOC_CHECK_RULE_IDS,
		docScopes: TSDOC_CHECK_DOC_SCOPES,
		groups: TSDOC_CHECK_RULE_GROUPS,
		optIn: TSDOC_CHECK_OPT_IN_RULE_IDS,
		promotes: true,
		styleScopes: TSDOC_CHECK_STYLE_SCOPES,
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
 * engineが受け取るdocScopeの一覧を返す
 *
 * @param name - 語彙を引くengine名
 * @returns 受け取るdocScopeの一覧 受け取らなければundefined
 */
export function docScopesOf(
	name: RuleEngineName,
): readonly string[] | undefined {
	return (RULE_VOCABULARY[name] as EngineVocabulary).docScopes;
}

/**
 * engineが受け取るstyleScopeの一覧を返す
 *
 * @param name - 語彙を引くengine名
 * @returns 受け取るstyleScopeの一覧 受け取らなければundefined
 */
export function styleScopesOf(
	name: RuleEngineName,
): readonly string[] | undefined {
	return (RULE_VOCABULARY[name] as EngineVocabulary).styleScopes;
}

/**
 * config fileを探索する既定のfile名
 */
export const DEFAULT_CONFIG_FILE = "quality.json";

/**
 * baseline fileの既定名
 */
export const DEFAULT_BASELINE_FILE = "quality-baseline.json";

type JsonObject = Record<string, unknown>;

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
	"code-style-check": { args: false, findings: true, skipped: {} },
	"comment-check": { args: false, findings: true, skipped: {} },
	"document-style-check": { args: false, findings: true, skipped: {} },
	"tsdoc-check": { args: false, findings: true, skipped: {} },
};

/**
 * sectionで許すoption名を能力から組み立てる
 *
 * @param name - option名を組み立てるengine名
 * @returns sectionで許すoption名の一覧
 */
function engineOptionKeys(name: EngineName): readonly string[] {
	const keys = ["enabled"];
	if (ENGINE_CAPABILITIES[name].args) {
		keys.push("args");
	}
	if (ENGINE_CAPABILITIES[name].skipped.targets === undefined) {
		keys.push("targets");
	}
	if (ENGINE_CAPABILITIES[name].skipped.ignore === undefined) {
		keys.push("ignore");
	}
	if (name === "typecheck") {
		keys.push("projects");
	}
	if (isRuleEngine(name)) {
		keys.push("rules");
		if (docScopesOf(name) !== undefined) {
			keys.push("docScope");
		}
		if (styleScopesOf(name) !== undefined) {
			keys.push("styleScope");
		}
	}
	return keys;
}

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEngineName(value: string): value is EngineName {
	return (ENGINE_NAMES as readonly string[]).includes(value);
}

function readStringArray(value: unknown, field: string): string[] | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (
		!Array.isArray(value) ||
		value.some((entry) => typeof entry !== "string" || entry === "")
	) {
		throw new Error(`${field} must be an array of non-empty strings`);
	}
	return [...value] as string[];
}

/**
 * scopeの指定を読み取る
 *
 * @param value - sectionが持つscopeの値
 * @param field - errorメッセージへ載せる位置
 * @param scopes - engineが受け取るscopeの一覧
 * @returns 読み取ったscope 指定が無ければundefined
 */
function readScope(
	value: unknown,
	field: string,
	scopes: readonly string[],
): string | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== "string" || !scopes.includes(value)) {
		throw new Error(`${field} must be one of ${scopes.join(", ")}`);
	}
	return value;
}

/**
 * engineごとの追加optionを読み取る
 *
 * @param value - engineのsection
 * @param name - optionを読み取るengine名
 * @param source - errorメッセージへ載せるconfig fileのpath
 * @returns 検証して既定値を補った追加option
 */
function readEngineOptions(
	value: JsonObject,
	name: RuleEngineName,
	source: string,
): Record<string, unknown> {
	const options: Record<string, unknown> = {};
	const docScopes = docScopesOf(name);
	if (docScopes !== undefined) {
		options.docScope =
			readScope(value.docScope, `${source}: ${name}.docScope`, docScopes) ??
			TSDOC_CHECK_DEFAULT_DOC_SCOPE;
	}
	const styleScopes = styleScopesOf(name);
	if (styleScopes !== undefined) {
		options.styleScope =
			readScope(
				value.styleScope,
				`${source}: ${name}.styleScope`,
				styleScopes,
			) ?? TSDOC_CHECK_DEFAULT_STYLE_SCOPE;
	}
	return options;
}

function readBoolean(value: unknown, field: string): boolean | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== "boolean") {
		throw new Error(`${field} must be a boolean`);
	}
	return value;
}

function readBaseline(
	value: unknown,
	source: string,
): string | false | undefined {
	if (value === undefined || value === false) {
		return value;
	}
	if (typeof value === "string" && value !== "") {
		return value;
	}
	throw new Error(`${source}: baseline must be a path string or false`);
}

/**
 * rule1つ分の状態を読み取る engineが昇格できないruleはerrorを拒否する
 */
function readRuleState(
	value: unknown,
	field: string,
	vocabulary: EngineVocabulary,
): RuleState {
	if (value !== "off" && value !== "on" && value !== "error") {
		throw new Error(`${field} must be "off", "on" or "error"`);
	}
	if (value === "error" && !vocabulary.promotes) {
		throw new Error(`${field} cannot treat a rule as an error`);
	}
	return value;
}

/**
 * presetの指定をruleの状態へ反映する
 *
 * @param states - 反映先のrule名ごとの状態
 * @param value - presetの値
 * @param field - errorメッセージへ載せる位置
 * @param vocabulary - 反映先engineの語彙
 */
function applyRulePreset(
	states: Map<string, RuleState>,
	value: unknown,
	field: string,
	vocabulary: EngineVocabulary,
): void {
	if (value === undefined || value === "recommended") {
		return;
	}
	if (value !== "all" && value !== "none") {
		throw new Error(`${field} must be "recommended", "all" or "none"`);
	}
	for (const rule of vocabulary.all) {
		states.set(rule, value === "all" ? "on" : "off");
	}
}

/**
 * group単位の指定をruleの状態へ反映する 文字列はgroup全体  objectはrule名ごとの状態
 *
 * @param states - 反映先のrule名ごとの状態
 * @param group - 反映するgroup名
 * @param entry - groupに渡された値
 * @param field - errorメッセージへ載せる位置
 * @param vocabulary - 反映先engineの語彙
 */
function applyRuleGroup(
	states: Map<string, RuleState>,
	group: string,
	entry: unknown,
	field: string,
	vocabulary: EngineVocabulary,
): void {
	const members = vocabulary.groups[group];
	if (members === undefined) {
		throw new Error(`${field} has an unknown rule group: ${group}`);
	}
	if (typeof entry === "string") {
		const state = readRuleState(entry, `${field}.${group}`, vocabulary);
		for (const rule of members) {
			states.set(rule, state);
		}
		return;
	}
	if (!isJsonObject(entry)) {
		throw new Error(`${field}.${group} must be a state or an object`);
	}
	for (const [rule, state] of Object.entries(entry)) {
		if (!members.includes(rule)) {
			throw new Error(`${field}.${group} has an unknown rule: ${rule}`);
		}
		states.set(
			rule,
			readRuleState(state, `${field}.${group}.${rule}`, vocabulary),
		);
	}
}

/**
 * ruleの状態をengineへ渡すrule名の一覧へ展開する
 *
 * @param states - rule名ごとの状態
 * @param vocabulary - 展開するengineの語彙
 * @returns engineへ渡すrule名の一覧
 */
function toRuleSelection(
	states: Map<string, RuleState>,
	vocabulary: EngineVocabulary,
): RuleSelection {
	const selection: RuleSelection = { disable: [], enable: [], error: [] };
	for (const [rule, state] of states) {
		if (state === "off") {
			if (!vocabulary.optIn.includes(rule)) {
				selection.disable.push(rule);
			}
			continue;
		}
		if (vocabulary.optIn.includes(rule)) {
			selection.enable.push(rule);
		}
		if (state === "error") {
			selection.error.push(rule);
		}
	}
	return selection;
}

/**
 * ruleの指定をengineへ渡す引数へ展開する
 *
 * presetで全体を選び groupでまとめて上書きし rule名で1つだけ上書きする 具体的な指定が勝つ
 *
 * @param value - quality.jsonが持つrulesの値
 * @param field - errorメッセージへ載せる位置
 * @param name - 語彙を引くengine名
 * @returns engineへ渡すrule名の一覧
 */
function readRuleSelection(
	value: unknown,
	field: string,
	name: RuleEngineName,
): RuleSelection {
	let entries: JsonObject = {};
	if (value !== undefined) {
		if (!isJsonObject(value)) {
			throw new Error(`${field} must be an object`);
		}
		entries = value;
	}
	const vocabulary: EngineVocabulary = RULE_VOCABULARY[name];
	const states = new Map<string, RuleState>();
	for (const rule of vocabulary.all) {
		states.set(rule, vocabulary.optIn.includes(rule) ? "off" : "on");
	}
	applyRulePreset(states, entries.preset, `${field}.preset`, vocabulary);
	for (const [group, entry] of Object.entries(entries)) {
		if (group !== "preset") {
			applyRuleGroup(states, group, entry, field, vocabulary);
		}
	}
	return toRuleSelection(states, vocabulary);
}

/**
 * engine1つ分の起動条件を読み取る engineが受け取らないoptionは設定errorにする
 */
function parseEngineOptions(
	value: JsonObject,
	source: string,
	name: EngineName,
): Record<string, unknown> {
	const unknown = Object.keys(value).find(
		(key) => !engineOptionKeys(name).includes(key),
	);
	if (unknown !== undefined) {
		throw new Error(`${source}: ${name} has an unknown option: ${unknown}`);
	}
	const options: Record<string, unknown> = {
		ignore: [],
		targets: [],
	};
	if (ENGINE_CAPABILITIES[name].args) {
		options.args = readStringArray(value.args, `${source}: ${name}.args`) ?? [];
	}
	if (ENGINE_CAPABILITIES[name].skipped.targets === undefined) {
		options.targets =
			readStringArray(value.targets, `${source}: ${name}.targets`) ?? [];
	}
	if (ENGINE_CAPABILITIES[name].skipped.ignore === undefined) {
		options.ignore =
			readStringArray(value.ignore, `${source}: ${name}.ignore`) ?? [];
	}
	if (name === "typecheck") {
		options.projects =
			readStringArray(value.projects, `${source}: ${name}.projects`) ?? [];
	}
	if (isRuleEngine(name)) {
		options.options = readEngineOptions(value, name, source);
		options.rules = readRuleSelection(
			value.rules,
			`${source}: ${name}.rules`,
			name,
		);
	}
	return options;
}

/**
 * 読み込んだ設定を検証して既定値を補う
 *
 * @param value - quality.jsonを解析した検証前の値
 * @param source - errorメッセージへ載せるconfig fileのpath
 * @returns 検証して既定値を補った統合検査の設定
 */
export function parseConfig(value: unknown, source: string): QualityConfig {
	if (!isJsonObject(value)) {
		throw new Error(`${source} must be a JSON object`);
	}
	const unknown = Object.keys(value).find(
		(key) =>
			key !== "$schema" &&
			key !== "baseline" &&
			key !== "failOnWarnings" &&
			!isEngineName(key),
	);
	if (unknown !== undefined) {
		throw new Error(`${source} has an unknown option: ${unknown}`);
	}
	const engines: Partial<Record<EngineName, boolean>> = {};
	const options: Partial<Record<EngineName, unknown>> = {};
	for (const name of ENGINE_NAMES) {
		const section = value[name];
		if (section === undefined) {
			engines[name] = false;
			continue;
		}
		if (!isJsonObject(section)) {
			throw new Error(`${source}: ${name} must be an object`);
		}
		engines[name] =
			readBoolean(section.enabled, `${source}: ${name}.enabled`) ?? false;
		options[name] = parseEngineOptions(section, source, name);
	}
	if (ENGINE_NAMES.every((name) => engines[name] !== true)) {
		throw new Error(`${source} must enable at least one engine`);
	}
	return {
		baseline: readBaseline(value.baseline, source) ?? DEFAULT_BASELINE_FILE,
		config: options as Partial<EngineConfigMap>,
		engines,
		failOnWarnings:
			readBoolean(value.failOnWarnings, `${source}: failOnWarnings`) ?? false,
	};
}

/**
 * 有効なengineを実行順で返す
 *
 * @param config - engineの有効無効を持つ統合検査の設定
 * @returns 有効なengine名を実行順に並べた配列
 */
export function enabledEngines(config: QualityConfig): EngineName[] {
	return ENGINE_NAMES.filter((name) => config.engines[name] === true);
}

/**
 * engineの起動条件を返す 無効なengineにはnullを返す
 *
 * @typeParam K - 起動条件を取り出すengine名の型
 * @param config - engineごとの起動条件を持つ統合検査の設定
 * @param name - 起動条件を取り出すengine名
 * @returns 指定したengineの起動条件 無効なengineならnull
 */
export function engineConfig<K extends EngineName>(
	config: QualityConfig,
	name: K,
): EngineConfigMap[K] | null {
	if (config.engines[name] !== true) {
		return null;
	}
	return config.config[name] ?? ({} as EngineConfigMap[K]);
}

/**
 * 作業ディレクトリからconfig fileを探す
 *
 * @param cwd - 探索を開始する作業ディレクトリのpath
 * @returns 見つけたconfig fileのpath 見つからなければnull
 */
export function findConfigFile(cwd: string): string | null {
	const candidate = resolve(cwd, DEFAULT_CONFIG_FILE);
	return existsSync(candidate) ? candidate : null;
}

/**
 * config fileを読み込んで検証する
 *
 * @param path - 読み込むconfig fileのpath
 * @returns 読み込んで検証した統合検査の設定
 */
export function loadConfig(path: string): QualityConfig {
	const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
	return parseConfig(JSON.parse(text), path);
}
