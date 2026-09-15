import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	ENGINE_CAPABILITIES,
	type EngineOptions,
	type ProcessEngineName,
	type QualityConfig,
	type TypecheckOptions,
} from "./config";
import { resolveTargets } from "./options";

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
 * 子プロセスで起動するengineごとの実行file名
 */
export const ENGINE_BINS: Record<ProcessEngineName, string> = {
	biome: "biome",
	knip: "knip",
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

	/**
	 * engine自身の出力へ色を付けるか
	 */
	color: boolean;

	/**
	 * 対応するengineへだけ足す上書き
	 */
	overrides: RunOverrides;
}

/**
 * engineが受け取らないため渡さなかった上書きを返す
 *
 * @param name - 受け取れない上書きを引くengine名
 * @param overrides - コマンドラインから渡された上書き
 * @returns 渡さなかった上書きとその理由の一覧
 */
export function skippedEngineOptions(
	name: ProcessEngineName,
	overrides: RunOverrides,
): string[] {
	const limits = ENGINE_CAPABILITIES[name].skipped;
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
 * node_modules/.binとPATHからengineの実行fileを探す
 *
 * @param name - 実行fileを探すengine名
 * @param cwd - 探索を開始する作業ディレクトリのpath
 * @returns 見つけた実行fileのpath PATHにも無ければnull
 */
export function resolveExecutable(
	name: ProcessEngineName,
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
function colorArguments(name: ProcessEngineName, color: boolean): string[] {
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
 * 統合runnerのwarning方針を子プロセスの引数へ変換する
 *
 * @param name - 引数を渡すengine名
 * @param context - 全体設定を持つ実行条件
 * @param configured - 利用者が明示した追加引数
 * @returns engineへ追加するwarning用の引数
 */
function warningArguments(
	name: ProcessEngineName,
	context: EngineCommandContext,
	configured: readonly string[],
): string[] {
	if (
		name === "biome" &&
		context.config.failOnWarnings &&
		!configured.includes("--error-on-warnings")
	) {
		return ["--error-on-warnings"];
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

/**
 * engineのsectionが無いときに使う既定の起動条件を返す
 *
 * @returns 子プロセスengineへ渡せる起動条件
 */
function defaultEngineOptions(): EngineOptions {
	return { args: [] };
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
	name: ProcessEngineName,
	executable: string,
	context: EngineCommandContext,
): string[] {
	const options: EngineOptions =
		context.config.config[name] ?? defaultEngineOptions();
	const limits = ENGINE_CAPABILITIES[name].skipped;
	const requested = resolveTargets(context.overrides.targets, []);
	const targets = limits.targets === undefined ? requested : [];
	if (name === "biome") {
		return [
			executable,
			"check",
			...colorArguments(name, context.color),
			...targets,
			...options.args,
			...warningArguments(name, context, options.args),
		];
	}
	if (name === "typecheck") {
		return buildTypecheckCommand(executable, context, undefined);
	}
	return [executable, ...options.args];
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
	name: ProcessEngineName,
	executable: string,
	context: EngineCommandContext,
): string[][] {
	const projects =
		name === "typecheck"
			? ((context.config.config.typecheck as TypecheckOptions | undefined)
					?.projects ?? [])
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
