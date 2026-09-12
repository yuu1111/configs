import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	type EngineName,
	type EngineOptions,
	engineConfig,
	type QualityConfig,
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
	"comment-check": {},
	"document-style-check": {},
	"tsdoc-check": {},
};

/**
 * engineが受け取らないため渡さなかった起動条件を返す
 */
export function skippedEngineOptions(
	name: EngineName,
	options: EngineOptions | undefined,
): string[] {
	if (options === undefined) {
		return [];
	}
	const limits = ENGINE_LIMITS[name];
	const skipped: string[] = [];
	for (const key of ["ignore", "targets"] as const) {
		const reason = limits[key];
		if (reason !== undefined && options[key] !== undefined) {
			skipped.push(`${key} skipped (${reason})`);
		}
	}
	return skipped;
}

/**
 * 検出をJSONで返すengineか
 */
export function isFindingEngine(name: EngineName): boolean {
	return (
		name === "comment-check" ||
		name === "document-style-check" ||
		name === "tsdoc-check"
	);
}

/**
 * node_modules/.binとPATHからengineの実行fileを探す
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
	const options = engineConfig(context.config, "typecheck") ?? {};
	return [
		executable,
		"--noEmit",
		...(project === undefined ? [] : ["--project", project]),
		...colorArguments("typecheck", context.color),
		...(options.args ?? []),
	];
}

/**
 * opt-in ruleを有効にするコマンド引数へ展開する
 */
function enableArguments(
	options: { enable?: string[] } | null | undefined,
): string[] {
	return (options?.enable ?? []).flatMap((rule) => ["--enable", rule]);
}

/**
 * engineへ渡すコマンドを組み立てる
 */
export function buildEngineCommand(
	name: EngineName,
	executable: string,
	context: EngineCommandContext,
): string[] {
	const options: EngineOptions = engineConfig(context.config, name) ?? {};
	const limits = ENGINE_LIMITS[name];
	const extra = options.args ?? [];
	const ignores =
		limits.ignore === undefined
			? [...(options.ignore ?? []), ...context.overrides.ignore]
			: [];
	const requested =
		context.overrides.targets.length > 0
			? context.overrides.targets
			: (options.targets ?? ["."]);
	const targets = limits.targets === undefined ? requested : [];
	const ignoreArguments = ignores.flatMap((ignore) => ["--ignore", ignore]);
	const rules = engineConfig(context.config, "tsdoc-check")?.error ?? [];
	const errorArguments = rules.flatMap((rule) => ["--error", rule]);
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
			...enableArguments(engineConfig(context.config, "comment-check")),
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
			...enableArguments(engineConfig(context.config, "document-style-check")),
			...targets,
			...ignoreArguments,
			...extra,
		];
	}
	return [
		executable,
		"--json",
		...errorArguments,
		...targets,
		...ignoreArguments,
		...extra,
	];
}

/**
 * engineの起動コマンドを順番に返す 型検査だけはprojectsごとに起動する
 */
export function buildEngineCommands(
	name: EngineName,
	executable: string,
	context: EngineCommandContext,
): string[][] {
	const projects =
		name === "typecheck"
			? (engineConfig(context.config, "typecheck")?.projects ?? [])
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
