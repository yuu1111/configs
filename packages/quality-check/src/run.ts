import { type BaselineFile, compareWithBaseline } from "./baseline";
import { type EngineName, enabledEngines, type QualityConfig } from "./config";
import {
	buildEngineCommand,
	ENGINE_BINS,
	type EngineCommandContext,
	type EngineProcessResult,
	type EngineRunner,
	isFindingEngine,
	type RunOverrides,
	resolveExecutable,
	runEngineProcess,
	skippedEngineOptions,
} from "./engines";
import { type NormalizedFinding, parseFindings } from "./findings";

/**
 * engine1つ分の実行状態
 */
export type EngineStatus = "error" | "failed" | "passed";

/**
 * engine1つ分の実行結果
 */
export interface EngineResult {
	/** baseline適用前の阻害する検出 */
	detected: NormalizedFinding[];
	exitCode: number | null;
	message?: string;
	name: EngineName;
	output: string;
	/** baseline適用後に残った阻害する検出 */
	reported: NormalizedFinding[];
	resolved: number;
	/** engineが受け取らなかった起動条件 */
	skipped: string[];
	status: EngineStatus;
	warnings: NormalizedFinding[];
}

/**
 * engineをまとめて起動するための実行条件
 */
export interface RunOptions {
	/** 適用するbaseline nullなら差分判定を行わない */
	baseline: BaselineFile | null;
	config: QualityConfig;
	cwd: string;
	/** コマンドラインから渡された起動条件の上書き */
	overrides: RunOverrides;
	/** comment-checkのbaseline差分を無効化する未作成のpath */
	rawBaseline: string;
	/** engineの実行fileを解決する関数 テストでは差し替える */
	resolve?: (name: EngineName, cwd: string) => string | null;
	runner?: EngineRunner;
}

function baseResult(
	name: EngineName,
	exitCode: number | null,
	output: string,
): Omit<EngineResult, "status"> {
	return {
		detected: [],
		exitCode,
		name,
		output,
		reported: [],
		resolved: 0,
		skipped: [],
		warnings: [],
	};
}

function joinOutput(result: EngineProcessResult): string {
	return [result.stdout, result.stderr]
		.map((part) => part.trimEnd())
		.filter((part) => part !== "")
		.join("\n");
}

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function runFindingEngine(
	name: EngineName,
	options: RunOptions,
	executable: string,
	context: EngineCommandContext,
	runner: EngineRunner,
): Promise<EngineResult> {
	const result = await runner(buildEngineCommand(name, executable, context), {
		cwd: options.cwd,
	});
	const output = joinOutput(result);
	if (result.exitCode === 2) {
		return {
			...baseResult(name, 2, output),
			message: `${name} could not finish`,
			status: "error",
		};
	}
	let parsed: ReturnType<typeof parseFindings>;
	try {
		parsed = parseFindings(name, result.stdout);
	} catch (error) {
		return {
			...baseResult(name, result.exitCode, output),
			message: describeError(error),
			status: "error",
		};
	}
	const comparison =
		options.baseline === null
			? { added: parsed.errors, resolved: [] }
			: compareWithBaseline(parsed.errors, options.baseline);
	return {
		...baseResult(name, result.exitCode, output),
		detected: parsed.errors,
		reported: comparison.added,
		resolved: comparison.resolved.length,
		status: comparison.added.length > 0 ? "failed" : "passed",
		warnings: parsed.warnings,
	};
}

async function runProcessEngine(
	name: EngineName,
	options: RunOptions,
	executable: string,
	context: EngineCommandContext,
	runner: EngineRunner,
): Promise<EngineResult> {
	const result = await runner(buildEngineCommand(name, executable, context), {
		cwd: options.cwd,
	});
	const output = joinOutput(result);
	if (result.exitCode === 2) {
		return {
			...baseResult(name, 2, output),
			message: `${name} could not finish`,
			status: "error",
		};
	}
	return {
		...baseResult(name, result.exitCode, output),
		status: result.exitCode === 0 ? "passed" : "failed",
	};
}

async function executeEngine(
	name: EngineName,
	options: RunOptions,
	context: EngineCommandContext,
	runner: EngineRunner,
): Promise<EngineResult> {
	const executable = (options.resolve ?? resolveExecutable)(name, options.cwd);
	if (executable === null) {
		return {
			...baseResult(name, null, ""),
			message: `${ENGINE_BINS[name]} is not installed`,
			status: "error",
		};
	}
	if (isFindingEngine(name)) {
		return await runFindingEngine(name, options, executable, context, runner);
	}
	return await runProcessEngine(name, options, executable, context, runner);
}

async function runEngine(
	name: EngineName,
	options: RunOptions,
	context: EngineCommandContext,
	runner: EngineRunner,
): Promise<EngineResult> {
	const result = await executeEngine(name, options, context, runner);
	return {
		...result,
		skipped: skippedEngineOptions(name, options.config.config?.[name]),
	};
}

/**
 * 設定で有効なengineを順に起動する
 */
export async function runEngines(options: RunOptions): Promise<EngineResult[]> {
	const runner = options.runner ?? runEngineProcess;
	const context: EngineCommandContext = {
		config: options.config,
		overrides: options.overrides,
		rawBaseline: options.rawBaseline,
	};
	const results: EngineResult[] = [];
	for (const name of enabledEngines(options.config)) {
		results.push(await runEngine(name, options, context, runner));
	}
	return results;
}
