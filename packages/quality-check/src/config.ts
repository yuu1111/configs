import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * 統合CLIが起動できるengineの名前 並び順が実行順になる
 */
export const ENGINE_NAMES = [
	"biome",
	"knip",
	"comment-check",
	"tsdoc-check",
] as const;

/**
 * engine名のunion型
 */
export type EngineName = (typeof ENGINE_NAMES)[number];

/**
 * engineのbinへ追加で渡す起動設定
 */
export interface EngineOptions {
	/** engineの既定引数の後ろへ足す引数 */
	args?: string[];
}

/**
 * quality.config.tsが受け付ける統合検査の設定
 */
export interface QualityConfig {
	/** 起動するengine 値がfalseまたは未指定のengineは起動しない */
	engines: Partial<Record<EngineName, boolean | EngineOptions>>;
	/** file走査engineが検査から外すpath */
	ignore?: string[];
	/** baseline fileのpath falseなら差分判定を行わない */
	baseline?: string | false;
	/** file走査engineへ渡す対象path */
	targets?: string[];
}

/**
 * 設定fileを型付けするための恒等関数
 */
export function defineConfig(config: QualityConfig): QualityConfig {
	return config;
}

/**
 * config fileを探索する既定のfile名
 */
export const DEFAULT_CONFIG_FILES = [
	"quality.config.ts",
	"quality.config.mts",
	"quality.config.js",
	"quality.config.mjs",
] as const;

/**
 * baseline fileの既定名
 */
export const DEFAULT_BASELINE_FILE = "quality-baseline.json";

type JsonObject = Record<string, unknown>;

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

function parseEngineOptions(
	value: unknown,
	source: string,
	name: EngineName,
): boolean | EngineOptions {
	if (typeof value === "boolean") {
		return value;
	}
	if (!isJsonObject(value)) {
		throw new Error(
			`${source}: engines.${name} must be a boolean or an object`,
		);
	}
	const unknown = Object.keys(value).filter((key) => key !== "args");
	if (unknown.length > 0) {
		throw new Error(
			`${source}: engines.${name} has an unknown option: ${unknown[0]}`,
		);
	}
	const args = readStringArray(value.args, `${source}: engines.${name}.args`);
	return args === undefined ? {} : { args };
}

/**
 * 読み込んだ設定を検証して不足分を補う
 */
export function parseConfig(value: unknown, source: string): QualityConfig {
	if (!isJsonObject(value)) {
		throw new Error(`${source} must export a config object`);
	}
	if (!isJsonObject(value.engines)) {
		throw new Error(`${source} must export an engines object`);
	}
	const engines: Partial<Record<EngineName, boolean | EngineOptions>> = {};
	for (const [name, options] of Object.entries(value.engines)) {
		if (!isEngineName(name)) {
			throw new Error(`${source}: unknown engine: ${name}`);
		}
		engines[name] = parseEngineOptions(options, source, name);
	}
	if (ENGINE_NAMES.every((name) => !engines[name])) {
		throw new Error(`${source} must enable at least one engine`);
	}
	const config: QualityConfig = { engines };
	const baseline = readBaseline(value.baseline, source);
	if (baseline !== undefined) {
		config.baseline = baseline;
	}
	const ignore = readStringArray(value.ignore, `${source}: ignore`);
	if (ignore !== undefined) {
		config.ignore = ignore;
	}
	const targets = readStringArray(value.targets, `${source}: targets`);
	if (targets !== undefined) {
		config.targets = targets;
	}
	return config;
}

/**
 * 有効なengineを実行順で返す
 */
export function enabledEngines(config: QualityConfig): EngineName[] {
	return ENGINE_NAMES.filter((name) => Boolean(config.engines[name]));
}

/**
 * engineの起動設定を返す 無効なengineにはnullを返す
 */
export function engineOptions(
	config: QualityConfig,
	name: EngineName,
): EngineOptions | null {
	const value = config.engines[name];
	if (!value) {
		return null;
	}
	return value === true ? {} : value;
}

/**
 * 作業ディレクトリからconfig fileを探す
 */
export function findConfigFile(cwd: string): string | null {
	for (const name of DEFAULT_CONFIG_FILES) {
		const candidate = resolve(cwd, name);
		if (existsSync(candidate)) {
			return candidate;
		}
	}
	return null;
}

/**
 * config fileを読み込んで検証する
 */
export async function loadConfig(path: string): Promise<QualityConfig> {
	const module: unknown = await import(pathToFileURL(path).href);
	const value =
		isJsonObject(module) && "default" in module ? module.default : module;
	return parseConfig(value, path);
}
