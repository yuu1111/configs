import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * 統合CLIが起動できるengineの名前 並び順が実行順になる
 */
export const ENGINE_NAMES = [
	"biome",
	"typecheck",
	"knip",
	"code-style-check",
	"comment-check",
	"document-style-check",
	"tsdoc-check",
] as const;

/**
 * engine名のunion型
 */
export type EngineName = (typeof ENGINE_NAMES)[number];

/**
 * engineへ渡す起動条件
 */
export interface EngineOptions {
	/** 検査から外すpath engineが受け取れないときはreportへ出す */
	ignore?: string[];
	/** 検査する対象path engineが受け取れないときはreportへ出す */
	targets?: string[];
	/** engineの既定引数の後ろへ足す引数 */
	args?: string[];
}

/**
 * comment-checkへ渡す起動条件
 */
export interface CommentCheckOptions extends EngineOptions {
	/** 既定で無効のopt-in ruleのうち有効にするrule名 */
	enable?: string[];
}

/**
 * document-style-checkへ渡す起動条件
 */
export interface DocumentStyleCheckOptions extends EngineOptions {
	/** 既定で無効のopt-in ruleのうち有効にするrule名 */
	enable?: string[];
}

/**
 * TSDoc検査へ渡す起動条件
 */
export interface TsdocCheckOptions extends EngineOptions {
	/** 違反として扱うrule名 */
	error?: string[];
}

/**
 * 型検査へ渡す起動条件
 */
export interface TypecheckOptions extends EngineOptions {
	/** 型検査するtsconfigのpath 省略時はカレントのtsconfig.jsonを1回だけ読む */
	projects?: string[];
}

/**
 * engine名ごとの起動条件
 */
export interface EngineConfigMap {
	biome: EngineOptions;
	typecheck: TypecheckOptions;
	knip: EngineOptions;
	"code-style-check": EngineOptions;
	"comment-check": CommentCheckOptions;
	"document-style-check": DocumentStyleCheckOptions;
	"tsdoc-check": TsdocCheckOptions;
}

/**
 * quality.config.tsが受け付ける統合検査の設定
 */
export interface QualityConfig {
	/** 起動するengine 値がfalseまたは未指定のengineは起動しない */
	engines: Partial<Record<EngineName, boolean>>;
	/** engineごとの起動条件 省略したengineは既定値で起動する */
	config?: Partial<EngineConfigMap>;
	/** baseline fileのpath falseなら差分判定を行わない */
	baseline?: string | false;
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

const ENGINE_OPTION_KEYS: Record<EngineName, readonly string[]> = {
	biome: ["args", "ignore", "targets"],
	typecheck: ["args", "ignore", "projects", "targets"],
	knip: ["args", "ignore", "targets"],
	"code-style-check": ["args", "ignore", "targets"],
	"comment-check": ["args", "enable", "ignore", "targets"],
	"document-style-check": ["args", "enable", "ignore", "targets"],
	"tsdoc-check": ["args", "error", "ignore", "targets"],
};

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

function parseEngines(
	value: unknown,
	source: string,
): Partial<Record<EngineName, boolean>> {
	if (!isJsonObject(value)) {
		throw new Error(`${source} must export an engines object`);
	}
	const engines: Partial<Record<EngineName, boolean>> = {};
	for (const [name, enabled] of Object.entries(value)) {
		if (!isEngineName(name)) {
			throw new Error(`${source}: unknown engine: ${name}`);
		}
		if (typeof enabled !== "boolean") {
			throw new Error(
				`${source}: engines.${name} must be a boolean 起動条件はconfigへ置く`,
			);
		}
		engines[name] = enabled;
	}
	if (ENGINE_NAMES.every((name) => !engines[name])) {
		throw new Error(`${source} must enable at least one engine`);
	}
	return engines;
}

type ParsedEngineOptions = EngineOptions & {
	enable?: string[];
	error?: string[];
	projects?: string[];
};

/**
 * engine名ごとにしか受け取らない起動条件を読み取る
 */
function parseEngineExtras(
	value: JsonObject,
	source: string,
	name: EngineName,
): ParsedEngineOptions {
	const extras: ParsedEngineOptions = {};
	if (name === "comment-check" || name === "document-style-check") {
		const enable = readStringArray(
			value.enable,
			`${source}: config.${name}.enable`,
		);
		if (enable !== undefined) {
			extras.enable = enable;
		}
	}
	if (name === "tsdoc-check") {
		const error = readStringArray(
			value.error,
			`${source}: config.${name}.error`,
		);
		if (error !== undefined) {
			extras.error = error;
		}
	}
	if (name === "typecheck") {
		const projects = readStringArray(
			value.projects,
			`${source}: config.${name}.projects`,
		);
		if (projects !== undefined) {
			if (projects.length === 0) {
				throw new Error(`${source}: config.${name}.projects must not be empty`);
			}
			extras.projects = projects;
		}
	}
	return extras;
}

function parseEngineOptions(
	value: JsonObject,
	source: string,
	name: EngineName,
): ParsedEngineOptions {
	const unknown = Object.keys(value).filter(
		(key) => !ENGINE_OPTION_KEYS[name].includes(key),
	);
	if (unknown.length > 0) {
		throw new Error(
			`${source}: config.${name} has an unknown option: ${unknown[0]}`,
		);
	}
	const options: ParsedEngineOptions = {};
	const ignore = readStringArray(
		value.ignore,
		`${source}: config.${name}.ignore`,
	);
	if (ignore !== undefined) {
		options.ignore = ignore;
	}
	const targets = readStringArray(
		value.targets,
		`${source}: config.${name}.targets`,
	);
	if (targets !== undefined) {
		options.targets = targets;
	}
	const args = readStringArray(value.args, `${source}: config.${name}.args`);
	if (args !== undefined) {
		options.args = args;
	}
	return { ...options, ...parseEngineExtras(value, source, name) };
}

function parseEngineConfig(
	value: unknown,
	source: string,
): Partial<EngineConfigMap> | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (!isJsonObject(value)) {
		throw new Error(`${source}: config must be an object`);
	}
	const config: Partial<EngineConfigMap> = {};
	for (const [name, options] of Object.entries(value)) {
		if (!isEngineName(name)) {
			throw new Error(`${source}: unknown engine in config: ${name}`);
		}
		if (!isJsonObject(options)) {
			throw new Error(`${source}: config.${name} must be an object`);
		}
		config[name] = parseEngineOptions(options, source, name);
	}
	return config;
}

/**
 * 読み込んだ設定を検証して不足分を補う
 */
export function parseConfig(value: unknown, source: string): QualityConfig {
	if (!isJsonObject(value)) {
		throw new Error(`${source} must export a config object`);
	}
	const config: QualityConfig = {
		engines: parseEngines(value.engines, source),
	};
	const engineConfig = parseEngineConfig(value.config, source);
	if (engineConfig !== undefined) {
		config.config = engineConfig;
	}
	const baseline = readBaseline(value.baseline, source);
	if (baseline !== undefined) {
		config.baseline = baseline;
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
 * engineの起動条件を返す 無効なengineにはnullを返す
 */
export function engineConfig<K extends EngineName>(
	config: QualityConfig,
	name: K,
): EngineConfigMap[K] | null {
	if (!config.engines[name]) {
		return null;
	}
	return config.config?.[name] ?? ({} as EngineConfigMap[K]);
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
