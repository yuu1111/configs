import {
	type EngineVocabulary,
	RULE_VOCABULARY,
	type RuleEngineName,
} from "../engines/catalog";
import type { RuleSelection } from "../engines/contract";
import { isJsonObject } from "../utils/json";
import type { RuleOp, RuleState } from "./types";

type JsonObject = Record<string, unknown>;

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
