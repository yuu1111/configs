import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	type EngineName,
	type EngineOptions,
	engineConfig,
	type QualityConfig,
	RULE_VOCABULARY,
	type RuleState,
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
 * engineが受け取らないため渡さなかった起動条件を返す
 *
 * @param name - 受け取れない起動条件を引くengine名
 * @param options - engineへ渡そうとした起動条件
 * @returns 渡さなかった起動条件とその理由の一覧
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
 * 設定fileが持つruleの指定
 */
interface RuleSelection {
	enable?: boolean;
	error?: boolean;
	rules?: Record<string, RuleState>;
}

/**
 * engineが公開するrule語彙
 */
type RuleVocabulary = (typeof RULE_VOCABULARY)[EngineName];

/**
 * 選んだruleを有効の一覧と違反の一覧へ反映する
 *
 * @param vocabulary - 反映先engineのrule語彙
 * @param selected - 反映先のrule名の集合
 * @param rule - 反映するrule名
 * @param state - 反映する状態
 */
function applyRuleState(
	vocabulary: RuleVocabulary,
	selected: { enable: Set<string>; error: Set<string> },
	rule: string,
	state: RuleState,
): void {
	if (state === "off") {
		selected.enable.delete(rule);
		selected.error.delete(rule);
		return;
	}
	if (state === "on") {
		selected.error.delete(rule);
	} else {
		selected.error.add(rule);
	}
	if (vocabulary.optIn.includes(rule)) {
		selected.enable.add(rule);
	}
}

/**
 * ruleの一括指定と個別指定をengineへ渡すruleの一覧へ展開する
 *
 * @param name - 展開するengine名
 * @param options - engineへ渡す起動条件
 * @returns --enableへ渡すrule名と--errorへ渡すrule名の組
 */
function selectRules(
	name: EngineName,
	options: EngineOptions | null | undefined,
): { enable: string[]; error: string[] } {
	const selection = (options ?? {}) as RuleSelection;
	const vocabulary = RULE_VOCABULARY[name];
	const selected = { enable: new Set<string>(), error: new Set<string>() };
	if (selection.enable === true) {
		for (const rule of vocabulary.optIn) {
			selected.enable.add(rule);
		}
	}
	if (selection.error === true) {
		for (const rule of vocabulary.all) {
			applyRuleState(vocabulary, selected, rule, "error");
		}
	}
	for (const [rule, state] of Object.entries(selection.rules ?? {})) {
		applyRuleState(vocabulary, selected, rule, state);
	}
	return { enable: [...selected.enable], error: [...selected.error] };
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
	const options: EngineOptions = engineConfig(context.config, name) ?? {};
	const limits = ENGINE_LIMITS[name];
	const selection = selectRules(name, options);
	const enableArguments = selection.enable.flatMap((rule) => [
		"--enable",
		rule,
	]);
	const errorArguments = selection.error.flatMap((rule) => ["--error", rule]);
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
			...enableArguments,
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
			...enableArguments,
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
		...enableArguments,
		...errorArguments,
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
