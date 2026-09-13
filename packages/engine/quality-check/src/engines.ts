import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
	EngineName,
	EngineOptions,
	QualityConfig,
	RuleEngineOptions,
	RuleSelection,
} from "./config";

/**
 * 子プロセスとして起動したengineの生の結果
 */
export interface EngineProcessResult {
	exitCode: number | null;
	stderr: string;
	stdout: string;
}

/**
 * engineを起動して出力を返す関数 テストでは差し替える
 */
export type EngineRunner = (
	command: string[],
	options: { cwd: string },
) => Promise<EngineProcessResult>;

/**
 * engineごとの実行file名
 */
export const ENGINE_BINS: Record<EngineName, string> = {
	biome: "biome",
	"code-style-check": "code-style-check",
	"comment-check": "comment-check",
	"document-style-check": "document-style-check",
	knip: "knip",
	"tsdoc-check": "tsdoc-check",
	typecheck: "tsc",
};

const WINDOWS_SHIMS = [".exe", ".cmd", ".bat", ""];
const POSIX_SHIMS = [""];

/**
 * コマンドラインから渡された起動条件の上書き
 */
export interface RunOverrides {
	ignore: string[];
	targets: string[];
}

/**
 * engineのコマンドを組み立てるための実行条件
 */
export interface EngineCommandContext {
	config: QualityConfig;
	/** engine自身の出力へ色を付けるか */
	color: boolean;
	/** 対応するengineへだけ足す上書き */
	overrides: RunOverrides;
	/** comment-checkのbaseline差分を無効化するために渡す未作成のpath */
	rawBaseline: string;
}

/**
 * engineが受け取らない起動条件と、その設定の持ち主
 */
export const ENGINE_LIMITS: Record<
	EngineName,
	Partial<Record<"ignore" | "targets", string>>
> = {
	biome: { ignore: "biome.json holds its settings" },
	typecheck: {
		ignore: "tsconfig.json holds its settings",
		targets: "tsconfig.json and projects hold its settings",
	},
	knip: {
		ignore: "knip.ts holds its settings",
		targets: "knip analyzes the whole project",
	},
	"code-style-check": {},
	"comment-check": {},
	"document-style-check": {},
	"tsdoc-check": {},
};

/**
 * engineが受け取らないため渡さなかった上書きを返す
 *
 * @param name - 受け取れない上書きを引くengine名
 * @param overrides - コマンドラインから渡された上書き
 * @returns 渡さなかった上書きとその理由の一覧
 */
export function skippedEngineOptions(
	name: EngineName,
	overrides: RunOverrides,
): string[] {
	const limits = ENGINE_LIMITS[name];
	const skipped: string[] = [];
	for (const key of ["ignore", "targets"] as const) {
		const reason = limits[key];
		if (reason !== undefined && overrides[key].length > 0) {
			skipped.push(`${key} skipped (${reason})`);
		}
	}
	return skipped;
}

/**
 * 検出をJSONで返すengineか
 *
 * @param name - 判定するengine名
 * @returns 検出をJSONで返すengineならtrue
 */
export function isFindingEngine(name: EngineName): boolean {
	return (
		name === "code-style-check" ||
		name === "comment-check" ||
		name === "document-style-check" ||
		name === "tsdoc-check"
	);
}

/**
 * node_modules/.binとPATHからengineの実行fileを探す
 *
 * @param name - 実行fileを探すengine名
 * @param cwd - 探索を開始する作業ディレクトリのpath
 * @returns 見つけた実行fileのpath PATHにも無ければnull
 */
export function resolveExecutable(
	name: EngineName,
	cwd: string,
): string | null {
	const shims = process.platform === "win32" ? WINDOWS_SHIMS : POSIX_SHIMS;
	const bin = ENGINE_BINS[name];
	let directory = cwd;
	for (;;) {
		for (const shim of shims) {
			const candidate = join(
				directory,
				"node_modules",
				".bin",
				`${bin}${shim}`,
			);
			if (existsSync(candidate)) {
				return candidate;
			}
		}
		const parent = dirname(directory);
		if (parent === directory) {
			break;
		}
		directory = parent;
	}
	const onPath = Bun.which(bin);
	return onPath ?? null;
}

/**
 * engine自身の出力へ色を付けるための引数を返す
 */
function colorArguments(name: EngineName, color: boolean): string[] {
	if (!color) {
		return [];
	}
	if (name === "biome") {
		return ["--colors=force"];
	}
	if (name === "typecheck") {
		return ["--pretty"];
	}
	return [];
}

/**
 * 型検査のコマンドを組み立てる projectを渡すとそのtsconfigを読む
 */
function buildTypecheckCommand(
	executable: string,
	context: EngineCommandContext,
	project: string | undefined,
): string[] {
	const options = context.config.config.typecheck;
	return [
		executable,
		"--noEmit",
		...(project === undefined ? [] : ["--project", project]),
		...colorArguments("typecheck", context.color),
		...(options?.args ?? []),
	];
}

const RULE_ENGINE_NAMES: readonly string[] = [
	"comment-check",
	"document-style-check",
	"tsdoc-check",
];

/**
 * ruleを持つengineへ渡すrule名を状態ごとに返す
 *
 * @param name - 起動するengine名
 * @param options - engineへ渡す起動条件
 * @returns --enableと--disableと--errorへ渡すrule名の組
 */
function ruleArguments(
	name: EngineName,
	options: EngineOptions,
): RuleSelection {
	if (!RULE_ENGINE_NAMES.includes(name)) {
		return { disable: [], enable: [], error: [] };
	}
	return (options as RuleEngineOptions).rules;
}

/**
 * 選んだruleをengineへ渡す引数へ展開する
 *
 * @param name - 起動するengine名
 * @param options - engineへ渡す起動条件
 * @returns --enableと--disableと--errorへ渡す引数
 */
function ruleArgumentsToFlags(
	name: EngineName,
	options: EngineOptions,
): string[] {
	const rules = ruleArguments(name, options);
	return [
		...rules.enable.flatMap((rule) => ["--enable", rule]),
		...rules.disable.flatMap((rule) => ["--disable", rule]),
		...rules.error.flatMap((rule) => ["--error", rule]),
	];
}

/**
 * 検査する対象pathを決める 上書きを優先し 無ければengineの指定 それも無ければカレントにする
 *
 * @param overrides - コマンドラインから渡された上書き
 * @param configured - engineのsectionが持つ対象path
 * @returns engineへ渡す対象path
 */
function resolveTargets(overrides: string[], configured: string[]): string[] {
	if (overrides.length > 0) {
		return overrides;
	}
	if (configured.length > 0) {
		return configured;
	}
	return ["."];
}

/**
 * engineへ渡すコマンドを組み立てる
 *
 * @param name - コマンドを組み立てるengine名
 * @param executable - 起動するengineの実行fileのpath
 * @param context - 設定と上書きを持つ実行条件
 * @returns engineへ渡す引数を並べたコマンド
 */
export function buildEngineCommand(
	name: EngineName,
	executable: string,
	context: EngineCommandContext,
): string[] {
	const configured = context.config.config[name] as EngineOptions | undefined;
	const options: EngineOptions = configured ?? {
		args: [],
		ignore: [],
		targets: [],
	};
	const limits = ENGINE_LIMITS[name];
	const ruleFlags = ruleArgumentsToFlags(name, options);
	const extra = options.args;
	const ignores =
		limits.ignore === undefined
			? [...options.ignore, ...context.overrides.ignore]
			: [];
	const requested = resolveTargets(context.overrides.targets, options.targets);
	const targets = limits.targets === undefined ? requested : [];
	const ignoreArguments = ignores.flatMap((ignore) => ["--ignore", ignore]);
	if (name === "biome") {
		return [
			executable,
			"check",
			...colorArguments(name, context.color),
			...targets,
			...extra,
		];
	}
	if (name === "typecheck") {
		return buildTypecheckCommand(executable, context, undefined);
	}
	if (name === "knip") {
		return [executable, ...extra];
	}
	if (name === "comment-check") {
		return [
			executable,
			"--json",
			"--baseline",
			context.rawBaseline,
			...ruleFlags,
			...targets,
			...ignoreArguments,
			...extra,
		];
	}
	if (name === "document-style-check") {
		return [
			executable,
			"lint",
			"--json",
			...ruleFlags,
			...targets,
			...ignoreArguments,
			...extra,
		];
	}
	if (name === "code-style-check") {
		return [executable, "--json", ...targets, ...ignoreArguments, ...extra];
	}
	return [
		executable,
		"--json",
		...ruleFlags,
		...targets,
		...ignoreArguments,
		...extra,
	];
}

/**
 * engineの起動コマンドを順番に返す 型検査だけはprojectsごとに起動する
 *
 * @param name - コマンドを組み立てるengine名
 * @param executable - 起動するengineの実行fileのpath
 * @param context - 設定と上書きを持つ実行条件
 * @returns 起動する順に並べたコマンドの配列
 */
export function buildEngineCommands(
	name: EngineName,
	executable: string,
	context: EngineCommandContext,
): string[][] {
	const projects =
		name === "typecheck"
			? (context.config.config.typecheck?.projects ?? [])
			: [];
	if (projects.length === 0) {
		return [buildEngineCommand(name, executable, context)];
	}
	return projects.map((project) =>
		buildTypecheckCommand(executable, context, project),
	);
}

/**
 * Bun.spawnでengineを起動する既定のrunner
 *
 * @param command - 実行fileと引数を並べたコマンド
 * @param options - engineを起動する作業ディレクトリを持つ条件
 * @returns 終了codeと標準出力と標準エラーを持つ結果
 */
export async function runEngineProcess(
	command: string[],
	options: { cwd: string },
): Promise<EngineProcessResult> {
	const child = Bun.spawn({
		cmd: command,
		cwd: options.cwd,
		stderr: "pipe",
		stdout: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	return { exitCode, stderr, stdout };
}
