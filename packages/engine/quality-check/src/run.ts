import {
	type BaselineFile,
	compareWithBaseline,
} from "@yuu1111/shared/baseline";
import { type EngineName, enabledEngines, type QualityConfig } from "./config";
import {
	buildEngineCommand,
	buildEngineCommands,
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
	/** engineの起動から結果の解釈までの所要ms 起動しなかった場合はnull */
	durationMs: number | null;
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
 * 実行時間を計測する前のengine1つ分の結果
 */
type EngineOutcome = Omit<EngineResult, "durationMs">;

/**
 * engineをまとめて起動するための実行条件
 */
export interface RunOptions {
	/** 適用するbaseline nullなら差分判定を行わない */
	baseline: BaselineFile | null;
	/** engine自身の出力へ色を付けるか */
	color: boolean;
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
): Omit<EngineOutcome, "status"> {
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

/**
 * 起動ごとの終了codeを1つへ寄せる 2は起動そのものの失敗として扱う
 */
function combineExitCode(codes: (number | null)[]): number | null {
	if (codes.some((code) => code === 2)) {
		return 2;
	}
	const failed = codes.find((code) => code !== 0);
	return failed === undefined ? 0 : failed;
}

/**
 * 1つのengineのために起動したコマンドとその結果
 */
interface ExecutedCommand {
	command: string[];
	result: EngineProcessResult;
}

/**
 * engineのコマンドを順に起動して出力をまとめる
 */
async function runCommands(
	commands: string[][],
	options: { cwd: string },
	runner: EngineRunner,
): Promise<{ exitCode: number | null; output: string }> {
	const executed: ExecutedCommand[] = [];
	for (const command of commands) {
		executed.push({ command, result: await runner(command, options) });
	}
	const labeled = commands.length > 1;
	const output = executed
		.map(({ command, result }) => {
			const text = joinOutput(result);
			if (!labeled) {
				return text;
			}
			const header = `$ ${command.join(" ")}`;
			return text === "" ? header : `${header}\n${text}`;
		})
		.filter((block) => block !== "")
		.join("\n\n");
	const exitCode = combineExitCode(
		executed.map((entry) => entry.result.exitCode),
	);
	return { exitCode, output };
}

async function runFindingEngine(
	name: EngineName,
	options: RunOptions,
	executable: string,
	context: EngineCommandContext,
	runner: EngineRunner,
): Promise<EngineOutcome> {
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
	const promoted = options.config.failOnWarnings
		? parsed.warnings.map(
				(finding): NormalizedFinding => ({ ...finding, severity: "error" }),
			)
		: [];
	const errors = [...parsed.errors, ...promoted];
	const comparison =
		options.baseline === null
			? { added: errors, resolved: [] }
			: compareWithBaseline(errors, options.baseline);
	return {
		...baseResult(name, result.exitCode, output),
		detected: errors,
		reported: comparison.added,
		resolved: comparison.resolved.length,
		status: comparison.added.length > 0 ? "failed" : "passed",
		warnings: options.config.failOnWarnings ? [] : parsed.warnings,
	};
}

async function runProcessEngine(
	name: EngineName,
	options: RunOptions,
	executable: string,
	context: EngineCommandContext,
	runner: EngineRunner,
): Promise<EngineOutcome> {
	const commands = buildEngineCommands(name, executable, context);
	const { exitCode, output } = await runCommands(
		commands,
		{ cwd: options.cwd },
		runner,
	);
	if (exitCode === 2) {
		return {
			...baseResult(name, 2, output),
			message: `${name} could not finish`,
			status: "error",
		};
	}
	return {
		...baseResult(name, exitCode, output),
		status: exitCode === 0 ? "passed" : "failed",
	};
}

async function runEngine(
	name: EngineName,
	options: RunOptions,
	context: EngineCommandContext,
	runner: EngineRunner,
): Promise<EngineResult> {
	const executable = (options.resolve ?? resolveExecutable)(name, options.cwd);
	const skipped = skippedEngineOptions(name, options.overrides);
	if (executable === null) {
		return {
			...baseResult(name, null, ""),
			durationMs: null,
			message: `${ENGINE_BINS[name]} is not installed`,
			skipped,
			status: "error",
		};
	}
	const startedAt = performance.now();
	const result = isFindingEngine(name)
		? await runFindingEngine(name, options, executable, context, runner)
		: await runProcessEngine(name, options, executable, context, runner);
	return {
		...result,
		durationMs: performance.now() - startedAt,
		skipped,
	};
}

/**
 * 設定で有効なengineを順に起動する
 *
 * @param options - 設定とrunnerを持つ実行条件
 * @returns 起動した順に並べたengineごとの実行結果
 */
export async function runEngines(options: RunOptions): Promise<EngineResult[]> {
	const runner = options.runner ?? runEngineProcess;
	const context: EngineCommandContext = {
		color: options.color,
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
