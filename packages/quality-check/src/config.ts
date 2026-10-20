import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	FILE_EXTENSIONS as CODE_STYLE_CHECK_FILE_EXTENSIONS,
	OPT_IN_RULE_IDS as CODE_STYLE_CHECK_OPT_IN_RULE_IDS,
	RULE_GROUPS as CODE_STYLE_CHECK_RULE_GROUPS,
	RULE_IDS as CODE_STYLE_CHECK_RULE_IDS,
} from "./engines/code-style/rule-ids";
import {
	FILE_EXTENSIONS as COMMENT_CHECK_FILE_EXTENSIONS,
	OPT_IN_RULE_IDS as COMMENT_CHECK_OPT_IN_RULE_IDS,
	RULE_GROUPS as COMMENT_CHECK_RULE_GROUPS,
	RULE_IDS as COMMENT_CHECK_RULE_IDS,
} from "./engines/comment/rule-ids";
import {
	FILE_EXTENSIONS as DOCUMENT_STYLE_CHECK_FILE_EXTENSIONS,
	OPT_IN_RULE_IDS as DOCUMENT_STYLE_CHECK_OPT_IN_RULE_IDS,
	RULE_GROUPS as DOCUMENT_STYLE_CHECK_RULE_GROUPS,
	RULE_IDS as DOCUMENT_STYLE_CHECK_RULE_IDS,
} from "./engines/document-style/rule-ids";
import {
	FILE_EXTENSIONS as TSDOC_CHECK_FILE_EXTENSIONS,
	OPT_IN_RULE_IDS as TSDOC_CHECK_OPT_IN_RULE_IDS,
	RULE_GROUPS as TSDOC_CHECK_RULE_GROUPS,
	RULE_IDS as TSDOC_CHECK_RULE_IDS,
	RULE_OPTIONS as TSDOC_CHECK_RULE_OPTIONS,
} from "./engines/tsdoc/rule-ids";
import type { RuleSelection } from "./shared/engines";

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
 * rule1つ分の状態 offで無効 onでengineの既定 warnとerrorで重大度を変更する
 */
export type RuleState = "off" | "on" | "warn" | "error";

/**
 * engineへ渡す起動条件
 */
export interface EngineOptions {
	/**
	 * engineの既定引数の後ろへ足す引数
	 */
	args: string[];
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
 * ruleへの操作 presetは全ruleを一括で設定し stateは指定したruleの状態を変え optionsはruleごとのoptionを重ねる
 */
export type RuleOp =
	| { kind: "preset"; value: "all" | "none" | "recommended" }
	| { kind: "state"; rules: string[]; state: RuleState }
	| { kind: "options"; options: Record<string, string>; rule: string };

/**
 * file globで選んだfileだけへ重ねるrule設定
 */
export interface RuleOverride {
	/**
	 * 対象fileを選ぶ順序付きglob 否定globは先に選んだ対象を除外する
	 */
	files: string[];

	/**
	 * この上書きが重ねるruleへの操作
	 */
	ops: RuleOp[];
}

/**
 * 検出engineへ渡す起動条件 検出engineはin-processで走るため追加の引数は持たない
 */
export interface RuleEngineOptions {
	/**
	 * 検査対象を選ぶglob 否定globは先に選んだ対象を除外する
	 */
	includes: string[];

	/**
	 * 上書きを重ねる前のruleへの操作
	 */
	ops: RuleOp[];

	/**
	 * fileごとにrule設定を重ねる上書き 書いた順に適用する
	 */
	overrides: RuleOverride[];

	/**
	 * 上書きを重ねる前に展開したrule選択
	 */
	rules: RuleSelection;
}

/**
 * engine名ごとの起動条件
 */
export interface EngineConfigMap {
	biome: EngineOptions;
	oxlint: EngineOptions;
	oxfmt: EngineOptions;
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
	"code-style-check": {
		all: CODE_STYLE_CHECK_RULE_IDS,
		extensions: CODE_STYLE_CHECK_FILE_EXTENSIONS,
		groups: CODE_STYLE_CHECK_RULE_GROUPS,
		optIn: CODE_STYLE_CHECK_OPT_IN_RULE_IDS,
	},
	"comment-check": {
		all: COMMENT_CHECK_RULE_IDS,
		extensions: COMMENT_CHECK_FILE_EXTENSIONS,
		groups: COMMENT_CHECK_RULE_GROUPS,
		optIn: COMMENT_CHECK_OPT_IN_RULE_IDS,
	},
	"document-style-check": {
		all: DOCUMENT_STYLE_CHECK_RULE_IDS,
		extensions: DOCUMENT_STYLE_CHECK_FILE_EXTENSIONS,
		groups: DOCUMENT_STYLE_CHECK_RULE_GROUPS,
		optIn: DOCUMENT_STYLE_CHECK_OPT_IN_RULE_IDS,
	},
	"tsdoc-check": {
		all: TSDOC_CHECK_RULE_IDS,
		extensions: TSDOC_CHECK_FILE_EXTENSIONS,
		groups: TSDOC_CHECK_RULE_GROUPS,
		optIn: TSDOC_CHECK_OPT_IN_RULE_IDS,
		ruleOptions: TSDOC_CHECK_RULE_OPTIONS,
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
	if (name === "typecheck") {
		keys.push("projects");
	}
	if (isRuleEngine(name)) {
		keys.push("includes", "overrides", "rules");
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
 * rule1つ分の状態を読み取る
 */
function readRuleState(value: unknown, field: string): RuleState {
	if (
		value !== "off" &&
		value !== "on" &&
		value !== "warn" &&
		value !== "error"
	) {
		throw new Error(`${field} must be "off", "on", "warn" or "error"`);
	}
	return value;
}

/**
 * ruleの状態とoptionを実行前に解決した結果
 */
interface ResolvedRules {
	/**
	 * ruleごとのoption
	 */
	options: Map<string, Record<string, string>>;

	/**
	 * ruleごとの状態
	 */
	states: Map<string, RuleState>;
}

/**
 * presetが選ぶruleの状態を返す
 *
 * @param preset - presetの値
 * @param optIn - ruleがopt-inか
 * @returns presetが選ぶ状態
 */
function presetState(
	preset: "all" | "none" | "recommended",
	optIn: boolean,
): RuleState {
	if (preset === "all") {
		return "on";
	}
	if (preset === "none") {
		return "off";
	}
	return optIn ? "off" : "on";
}

/**
 * ruleへの操作を解決中の状態へ重ねる
 *
 * @param resolved - 重ねる先の状態
 * @param op - 重ねる操作
 * @param vocabulary - 重ねるengineの語彙
 */
function applyRuleOp(
	resolved: ResolvedRules,
	op: RuleOp,
	vocabulary: EngineVocabulary,
): void {
	if (op.kind === "preset") {
		resolved.options.clear();
		for (const rule of vocabulary.all) {
			resolved.states.set(
				rule,
				presetState(op.value, vocabulary.optIn.includes(rule)),
			);
		}
		return;
	}
	if (op.kind === "state") {
		for (const rule of op.rules) {
			resolved.states.set(rule, op.state);
		}
		return;
	}
	resolved.options.set(op.rule, {
		...resolved.options.get(op.rule),
		...op.options,
	});
}

/**
 * rule1つの状態をrule選択の該当する一覧へ振り分ける
 *
 * @param selection - 振り分け先のrule選択
 * @param rule - 振り分けるrule名
 * @param state - ruleの状態
 * @param optIn - ruleがopt-inか
 */
function placeRule(
	selection: RuleSelection,
	rule: string,
	state: RuleState,
	optIn: boolean,
): void {
	if (state === "off") {
		if (!optIn) {
			selection.disable.push(rule);
		}
		return;
	}
	if (optIn) {
		selection.enable.push(rule);
	}
	if (state === "error") {
		selection.error.push(rule);
	}
	if (state === "warn") {
		selection.warn.push(rule);
	}
}

/**
 * 解決したruleの状態をengineへ渡すrule選択へ展開する
 *
 * @param resolved - 解決したruleの状態
 * @param vocabulary - 展開するengineの語彙
 * @returns engineへ渡すrule選択
 */
function toRuleSelection(
	resolved: ResolvedRules,
	vocabulary: EngineVocabulary,
): RuleSelection {
	const selection: RuleSelection = {
		disable: [],
		enable: [],
		error: [],
		warn: [],
	};
	for (const [rule, state] of resolved.states) {
		placeRule(selection, rule, state, vocabulary.optIn.includes(rule));
	}
	const options: Record<string, Record<string, string>> = {};
	for (const [rule, entry] of resolved.options) {
		if (Object.keys(entry).length > 0) {
			options[rule] = entry;
		}
	}
	if (Object.keys(options).length > 0) {
		selection.options = options;
	}
	return selection;
}

/**
 * ruleへの操作を順に重ねてengineへ渡すrule選択を作る
 *
 * @param name - 語彙を引くengine名
 * @param opsLists - 先に重ねる順に並べた操作の列
 * @returns engineへ渡すrule選択
 */
export function selectionFor(
	name: RuleEngineName,
	opsLists: readonly (readonly RuleOp[])[],
): RuleSelection {
	const vocabulary: EngineVocabulary = RULE_VOCABULARY[name];
	const states = new Map<string, RuleState>();
	for (const rule of vocabulary.all) {
		states.set(rule, vocabulary.optIn.includes(rule) ? "off" : "on");
	}
	const resolved: ResolvedRules = { options: new Map(), states };
	for (const ops of opsLists) {
		for (const op of ops) {
			applyRuleOp(resolved, op, vocabulary);
		}
	}
	return toRuleSelection(resolved, vocabulary);
}

const RULE_ENTRY_KEYS = ["level", "options"];

/**
 * ruleまたはgroupに渡された値を読み取る 文字列は状態 objectはlevelとoptions
 *
 * @param entry - ruleまたはgroupに渡された値
 * @param field - errorメッセージへ載せる位置
 * @returns 読み取った状態とoption
 */
function readRuleEntry(
	entry: unknown,
	field: string,
): { level?: RuleState; options?: JsonObject } {
	if (typeof entry === "string") {
		return { level: readRuleState(entry, field) };
	}
	if (!isJsonObject(entry)) {
		throw new Error(`${field} must be a state or an object`);
	}
	const unknown = Object.keys(entry).find(
		(key) => !RULE_ENTRY_KEYS.includes(key),
	);
	if (unknown !== undefined) {
		throw new Error(`${field} has an unknown option: ${unknown}`);
	}
	const result: { level?: RuleState; options?: JsonObject } = {};
	if (entry.level !== undefined) {
		result.level = readRuleState(entry.level, `${field}.level`);
	}
	if (entry.options !== undefined) {
		if (!isJsonObject(entry.options)) {
			throw new Error(`${field}.options must be an object`);
		}
		result.options = entry.options;
	}
	return result;
}

/**
 * optionをruleへ渡す操作へ展開する groupではそのoptionを受け取るruleだけへ渡す
 *
 * @param rules - optionを渡す先のrule
 * @param options - 渡すoption
 * @param field - errorメッセージへ載せる位置
 * @param vocabulary - 展開するengineの語彙
 * @returns ruleごとのoptionの操作
 */
function readOptionOps(
	rules: readonly string[],
	options: JsonObject,
	field: string,
	vocabulary: EngineVocabulary,
): RuleOp[] {
	const ops: RuleOp[] = [];
	for (const [key, value] of Object.entries(options)) {
		if (typeof value !== "string") {
			throw new Error(`${field}.options.${key} must be a string`);
		}
		const accepting = rules.filter(
			(rule) => vocabulary.ruleOptions?.[rule]?.[key]?.includes(value) === true,
		);
		if (accepting.length === 0) {
			throw new Error(`${field}.options.${key} is not accepted: ${value}`);
		}
		for (const rule of accepting) {
			ops.push({ kind: "options", options: { [key]: value }, rule });
		}
	}
	return ops;
}

/**
 * groupの下にrule名を並べた旧書式か level と options 以外のkeyを持つobjectを指す
 *
 * @param entry - groupに渡された値
 * @returns groupの下にrule名を並べた旧書式ならtrue
 */
function isRuleMapEntry(entry: unknown): entry is JsonObject {
	return (
		isJsonObject(entry) &&
		Object.keys(entry).some((key) => !RULE_ENTRY_KEYS.includes(key))
	);
}

/**
 * presetの値を操作へ読み取る
 *
 * @param value - rulesの値
 * @param field - errorメッセージへ載せる位置
 * @returns presetの操作 指定が無ければ空
 */
function readPresetOps(value: JsonObject, field: string): RuleOp[] {
	const preset = value.preset;
	if (preset === undefined) {
		return [];
	}
	if (preset !== "recommended" && preset !== "all" && preset !== "none") {
		throw new Error(`${field}.preset must be "recommended", "all" or "none"`);
	}
	return [{ kind: "preset", value: preset }];
}

/**
 * groupまたはruleの1件を操作へ読み取る
 *
 * @param key - groupまたはruleの名前
 * @param entry - 渡された値
 * @param field - errorメッセージへ載せる位置
 * @param vocabulary - 語彙を持つengineの語彙
 * @returns 読み取った操作とgroupの指定か
 */
function readTargetOps(
	key: string,
	entry: unknown,
	field: string,
	vocabulary: EngineVocabulary,
): { group: boolean; ops: RuleOp[] } {
	const members = vocabulary.groups[key];
	if (members === undefined && !vocabulary.all.includes(key)) {
		throw new Error(`${field} has an unknown rule or group: ${key}`);
	}
	if (members !== undefined && isRuleMapEntry(entry)) {
		throw new Error(
			`${field}.${key} lists rules under a group; write the rules directly under rules (quality-check migrate rewrites this)`,
		);
	}
	const targets = members === undefined ? [key] : [...members];
	const parsed = readRuleEntry(entry, `${field}.${key}`);
	const ops: RuleOp[] = [];
	if (parsed.level !== undefined) {
		ops.push({ kind: "state", rules: targets, state: parsed.level });
	}
	if (parsed.options !== undefined) {
		ops.push(
			...readOptionOps(targets, parsed.options, `${field}.${key}`, vocabulary),
		);
	}
	return { group: members !== undefined, ops };
}

/**
 * rulesの値をruleへの操作の列へ読み取る
 *
 * presetで全体を選び groupでまとめて重ね rule名で1つだけ重ねる 具体的な指定が勝つ
 *
 * @param value - rulesの値
 * @param field - errorメッセージへ載せる位置
 * @param name - 語彙を引くengine名
 * @returns ruleへの操作の列
 */
export function readRuleOps(
	value: unknown,
	field: string,
	name: RuleEngineName,
): RuleOp[] {
	if (value === undefined) {
		return [];
	}
	if (!isJsonObject(value)) {
		throw new Error(`${field} must be an object`);
	}
	const vocabulary: EngineVocabulary = RULE_VOCABULARY[name];
	const groupOps: RuleOp[] = [];
	const ruleOps: RuleOp[] = [];
	for (const [key, entry] of Object.entries(value)) {
		if (key !== "preset") {
			const target = readTargetOps(key, entry, field, vocabulary);
			(target.group ? groupOps : ruleOps).push(...target.ops);
		}
	}
	return [...readPresetOps(value, field), ...groupOps, ...ruleOps];
}

/**
 * ruleの指定をengineへ渡すrule選択へ展開する
 *
 * @param value - quality.jsonが持つrulesの値
 * @param field - errorメッセージへ載せる位置
 * @param name - 語彙を引くengine名
 * @returns engineへ渡すrule選択
 */
export function readRuleSelection(
	value: unknown,
	field: string,
	name: RuleEngineName,
): RuleSelection {
	return selectionFor(name, [readRuleOps(value, field, name)]);
}

/**
 * overridesの値を読み取る
 *
 * @param value - overridesの値
 * @param field - errorメッセージへ載せる位置
 * @param name - 語彙を引くengine名
 * @returns 書いた順に並べた上書き
 */
function readOverrides(
	value: unknown,
	field: string,
	name: RuleEngineName,
): RuleOverride[] {
	if (value === undefined) {
		return [];
	}
	if (!Array.isArray(value)) {
		throw new Error(`${field} must be an array`);
	}
	return value.map((entry: unknown, index) => {
		const path = `${field}[${index}]`;
		if (!isJsonObject(entry)) {
			throw new Error(`${path} must be an object`);
		}
		const unknown = Object.keys(entry).find(
			(key) => key !== "files" && key !== "rules",
		);
		if (unknown !== undefined) {
			throw new Error(`${path} has an unknown option: ${unknown}`);
		}
		const files = readStringArray(entry.files, `${path}.files`);
		if (files === undefined || files.length === 0) {
			throw new Error(`${path}.files must be a non-empty array of globs`);
		}
		if (entry.rules === undefined) {
			throw new Error(`${path}.rules is required`);
		}
		return { files, ops: readRuleOps(entry.rules, `${path}.rules`, name) };
	});
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
		const moved =
			unknown === "docScope" || unknown === "styleScope"
				? "; it became a scope option of the rule (quality-check migrate rewrites this)"
				: "";
		throw new Error(
			`${source}: ${name} has an unknown option: ${unknown}${moved}`,
		);
	}
	const options: Record<string, unknown> = {};
	if (ENGINE_CAPABILITIES[name].args) {
		options.args = readStringArray(value.args, `${source}: ${name}.args`) ?? [];
	}
	if (name === "typecheck") {
		options.projects =
			readStringArray(value.projects, `${source}: ${name}.projects`) ?? [];
	}
	if (isRuleEngine(name)) {
		const ops = readRuleOps(value.rules, `${source}: ${name}.rules`, name);
		options.includes = readStringArray(
			value.includes,
			`${source}: ${name}.includes`,
		) ?? ["**"];
		options.ops = ops;
		options.overrides = readOverrides(
			value.overrides,
			`${source}: ${name}.overrides`,
			name,
		);
		options.rules = selectionFor(name, [ops]);
	}
	return options;
}

/**
 * engineのsection1つを読み取る 真偽値だけの短い書き方も受け付ける
 *
 * @param section - sectionの値
 * @param source - errorメッセージへ載せるconfig fileのpath
 * @param name - 読み取るengine名
 * @returns 有効かどうかと起動条件 sectionが無ければundefined
 */
function parseSection(
	section: unknown,
	source: string,
	name: EngineName,
): { enabled: boolean; options: Record<string, unknown> } | undefined {
	if (section === undefined) {
		return undefined;
	}
	if (typeof section === "boolean") {
		return { enabled: section, options: parseEngineOptions({}, source, name) };
	}
	if (!isJsonObject(section)) {
		throw new Error(`${source}: ${name} must be an object or a boolean`);
	}
	return {
		enabled: readBoolean(section.enabled, `${source}: ${name}.enabled`) ?? true,
		options: parseEngineOptions(section, source, name),
	};
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
		const section = parseSection(value[name], source, name);
		engines[name] = section?.enabled ?? false;
		if (section !== undefined) {
			options[name] = section.options;
		}
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
