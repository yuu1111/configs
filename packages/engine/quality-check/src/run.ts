import {
	type BaselineEntry,
	type BaselineFile,
	compareWithBaseline,
} from "@yuu1111/shared/baseline";
import { normalizePath } from "@yuu1111/shared/files";
import {
	type EngineName,
	enabledEngines,
	type FindingEngineName,
	type ProcessEngineName,
	type QualityConfig,
	type RuleEngineOptions,
} from "./config";
import {
	FINDING_ENGINES,
	type FindingEngineRegistry,
	isFindingEngine,
} from "./engines";
import { type NormalizedFinding, normalizeReport } from "./findings";
import { resolveTargets } from "./options";
import {
	buildEngineCommands,
	ENGINE_BINS,
	type EngineCommandContext,
	type EngineProcessResult,
	type EngineRunner,
	type RunOverrides,
	resolveExecutable,
	runEngineProcess,
	skippedEngineOptions,
} from "./process";

/**
 * engine1つ分の実行状態
 */
export type EngineStatus = "error" | "failed" | "passed";

/**
 * engine1つ分の実行結果
 */
export interface EngineResult {
	/**
	 * baseline適用前の阻害する検出
	 */
	detected: NormalizedFinding[];

	/**
	 * engineの起動から結果の解釈までの所要ms 起動しなかった場合はnull
	 */
	durationMs: number | null;

	/**
	 * 子プロセスengineの終了code in-processのengineはnull
	 */
	exitCode: number | null;
	message?: string;
	name: EngineName;
	output: string;

	/**
	 * baseline適用後に残った阻害する検出
	 */
	reported: NormalizedFinding[];
	resolved: number;

	/**
	 * engineが受け取らなかった起動条件
	 */
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
	/**
	 * 適用するbaseline nullなら差分判定を行わない
	 */
	baseline: BaselineFile | null;

	/**
	 * engine自身の出力へ色を付けるか
	 */
	color: boolean;
	config: QualityConfig;
	cwd: string;

	/**
	 * in-processのengine実装 テストでは差し替える
	 */
	findingEngines?: FindingEngineRegistry;

	/**
	 * コマンドラインから渡された起動条件の上書き
	 */
	overrides: RunOverrides;

	/**
	 * 起動するengineの指定 省略時と空配列は設定で有効なengineすべてになる
	 */
	selected?: readonly EngineName[];

	/**
	 * engineの実行fileを解決する関数 テストでは差し替える
	 */
	resolve?: (name: ProcessEngineName, cwd: string) => string | null;
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

async function runProcessEngine(
	name: ProcessEngineName,
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

/**
 * 検出engineが無いときに使う既定のrule選択を返す
 *
 * @returns どのruleも選ばない起動条件
 */
function defaultRuleOptions(): RuleEngineOptions {
	return {
		includes: ["**"],
		options: {},
		rules: { disable: [], enable: [], error: [], warn: [] },
	};
}

function exclusionPatterns(paths: readonly string[]): string[] {
	return paths.flatMap((path) => {
		const normalized = normalizePath(path);
		return [`!${normalized}`, `!${normalized}/**`];
	});
}

/**
 * 検出engineをin-processで起動し baselineを適用する
 */
function runFindingEngine(
	name: FindingEngineName,
	options: RunOptions,
): EngineResult {
	const engine = (options.findingEngines ?? FINDING_ENGINES)[name];
	const configured = options.config.config[name] ?? defaultRuleOptions();
	const startedAt = performance.now();
	try {
		const report = engine({
			cwd: options.cwd,
			includes: [
				...configured.includes,
				...exclusionPatterns(options.overrides.ignore),
			],
			options: configured.options,
			rules: configured.rules,
			targets: resolveTargets(options.overrides.targets, []),
		});
		const parsed = normalizeReport(name, report);
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
			...baseResult(name, null, ""),
			detected: errors,
			durationMs: performance.now() - startedAt,
			reported: comparison.added,
			resolved: comparison.resolved.length,
			status: comparison.added.length > 0 ? "failed" : "passed",
			warnings: options.config.failOnWarnings ? [] : parsed.warnings,
		};
	} catch (error) {
		return {
			...baseResult(name, null, ""),
			durationMs: performance.now() - startedAt,
			message: `${name} could not finish: ${describeError(error)}`,
			status: "error",
		};
	}
}

async function runEngine(
	name: EngineName,
	options: RunOptions,
	context: EngineCommandContext,
	runner: EngineRunner,
): Promise<EngineResult> {
	if (isFindingEngine(name)) {
		return runFindingEngine(name, options);
	}
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
	const result = await runProcessEngine(
		name,
		options,
		executable,
		context,
		runner,
	);
	return {
		...result,
		durationMs: performance.now() - startedAt,
		skipped,
	};
}

/**
 * 起動するengineを決める 未指定と空配列は設定で有効なengineすべてになる
 *
 * @param config - engineの有効無効を持つ統合検査の設定
 * @param selected - 起動するengineの指定
 * @returns ENGINE_NAMESの並びを保った起動するengine名
 */
function selectedEngines(
	config: QualityConfig,
	selected: readonly EngineName[] | undefined,
): EngineName[] {
	const enabled = enabledEngines(config);
	if (selected === undefined || selected.length === 0) {
		return [...enabled];
	}
	for (const name of selected) {
		if (!enabled.includes(name)) {
			throw new Error(`${name} is not enabled`);
		}
	}
	return enabled.filter((name) => selected.includes(name));
}

/**
 * baselineを起動するengineだけに絞る engine名の無いentryは残す
 *
 * @param baseline - 読み込み済みのbaseline
 * @param selected - 起動するengineの指定
 * @returns 起動しないengineのentryを除いたbaseline
 */
function scopeBaseline(
	baseline: BaselineFile | null,
	selected: readonly EngineName[] | undefined,
): BaselineFile | null {
	if (baseline === null || selected === undefined || selected.length === 0) {
		return baseline;
	}
	const names = selected as readonly string[];
	const entries: BaselineEntry[] = baseline.entries.filter(
		(entry) => entry.engine === undefined || names.includes(entry.engine),
	);
	return { ...baseline, entries };
}

/**
 * 設定で有効なengineを順に起動する
 *
 * @param options - 設定とrunnerを持つ実行条件
 * @returns 起動した順に並べたengineごとの実行結果
 */
export async function runEngines(options: RunOptions): Promise<EngineResult[]> {
	const runner = options.runner ?? runEngineProcess;
	const names = selectedEngines(options.config, options.selected);
	const baseline = scopeBaseline(options.baseline, options.selected);
	const context: EngineCommandContext = {
		color: options.color,
		config: options.config,
		overrides: options.overrides,
	};
	const results: EngineResult[] = [];
	for (const name of names) {
		results.push(
			await runEngine(name, { ...options, baseline }, context, runner),
		);
	}
	return results;
}
