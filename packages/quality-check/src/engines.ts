import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { type EngineName, engineOptions, type QualityConfig } from "./config";

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
};

const WINDOWS_SHIMS = [".exe", ".cmd", ".bat", ""];
const POSIX_SHIMS = [""];

/**
 * engineのコマンドを組み立てるための実行条件
 */
export interface EngineCommandContext {
	config: QualityConfig;
	ignores: string[];
	/** comment-checkのbaseline差分を無効化するために渡す未作成のpath */
	rawBaseline: string;
	targets: string[];
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
 * engineへ渡すコマンドを組み立てる
 */
export function buildEngineCommand(
	name: EngineName,
	executable: string,
	context: EngineCommandContext,
): string[] {
	const extra = engineOptions(context.config, name)?.args ?? [];
	if (name === "biome") {
		return [executable, "check", ...context.targets, ...extra];
	}
	if (name === "knip") {
		return [executable, ...extra];
	}
	const ignoreArguments = context.ignores.flatMap((ignore) => [
		"--ignore",
		ignore,
	]);
	if (name === "comment-check") {
		return [
			executable,
			"--json",
			"--baseline",
			context.rawBaseline,
			...context.targets,
			...ignoreArguments,
			...extra,
		];
	}
	if (name === "document-style-check") {
		return [
			executable,
			"lint",
			"--json",
			...context.targets,
			...ignoreArguments,
			...extra,
		];
	}
	return [
		executable,
		"--json",
		...context.targets,
		...ignoreArguments,
		...extra,
	];
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
