import {
	ENGINE_CAPABILITIES,
	ENGINE_NAMES,
	type EngineName,
	isRuleEngine,
	type RuleEngineName,
} from "../engines/catalog";
import { canonicalEngineName } from "../engines/legacy-names";
import { isJsonObject } from "../utils/json";
import { DEFAULT_BASELINE_FILE } from "./defaults";
import { readRuleOps, selectionFor } from "./rules";
import type { EngineConfigMap, QualityConfig, RuleOverride } from "./types";

type JsonObject = Record<string, unknown>;

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
		keys.push("projects", "tool");
	}
	if (isRuleEngine(name)) {
		keys.push("includes", "overrides", "rules");
	}
	return keys;
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
		if (
			value.tool !== undefined &&
			value.tool !== "tsc" &&
			value.tool !== "bun"
		) {
			throw new Error(`${source}: typecheck.tool must be tsc or bun`);
		}
		options.tool = value.tool ?? "tsc";
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
		const current = canonicalEngineName(unknown);
		const renamed =
			current === unknown
				? ""
				: `; renamed to ${current}; run quality-check migrate`;
		throw new Error(`${source} has an unknown option: ${unknown}${renamed}`);
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
