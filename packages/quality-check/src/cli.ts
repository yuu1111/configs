#!/usr/bin/env bun
import { resolve } from "node:path";
import {
	DEFAULT_BASELINE_FILE,
	type EngineName,
	findConfigFile,
	loadConfig,
	type QualityConfig,
} from "./config";
import { main as markdownMain } from "./markdown";
import { main as migrateMain } from "./migrate";
import { splitEngineSelection } from "./options";
import { formatEngineSection, formatSummary, toJsonReport } from "./report";
import { runEngines } from "./run";
import { createBaseline, readBaseline, writeBaseline } from "./shared/baseline";
import { parseArgv, runCli, wantsHelp } from "./shared/cli";
import { ansiPainter, colorEnabled, plainPainter } from "./shared/color";

const USAGE = [
	"Usage: quality-check [engine...] [--config <path>] [--baseline <path>] [--ignore <path>] [--update-baseline] [--json] [path...]",
	"       quality-check markdown <scan|check|lint> [options] [path...]",
	"       quality-check migrate [--config <path>] [--write] [--from-v5]",
].join("\n");

interface Options {
	baselinePath: string | undefined;
	configPath: string | undefined;
	ignores: string[];
	json: boolean;
	targets: string[];
	update: boolean;
}

function parseArguments(argv: string[]): Options {
	const parsed = parseArgv(argv, {
		flags: ["json", "update-baseline"],
		values: ["baseline", "config", "ignore"],
	});
	return {
		baselinePath: parsed.values.get("baseline")?.at(-1),
		configPath: parsed.values.get("config")?.at(-1),
		ignores: [...(parsed.values.get("ignore") ?? [])],
		json: parsed.flags.has("json"),
		targets: parsed.targets,
		update: parsed.flags.has("update-baseline"),
	};
}

/**
 * 位置引数をengine選択と対象pathへ分け baseline更新との組み合わせを検証する
 *
 * @param targets - コマンドラインの位置引数の一覧
 * @param update - baselineを置き換えるか
 * @returns 起動するengineと対象path
 */
function resolveRunSelection(
	targets: string[],
	update: boolean,
): { selected: EngineName[]; targets: string[] } {
	const selection = splitEngineSelection(targets);
	if (update && selection.engines.length > 0) {
		throw new Error("--update-baseline runs every enabled engine");
	}
	return { selected: selection.engines, targets: selection.targets };
}

function resolveBaselinePath(
	options: Options,
	config: QualityConfig,
	cwd: string,
): string | null {
	if (options.baselinePath !== undefined) {
		return resolve(cwd, options.baselinePath);
	}
	if (config.baseline === false) {
		return null;
	}
	return resolve(cwd, config.baseline ?? DEFAULT_BASELINE_FILE);
}

function resolveConfigPath(options: Options, cwd: string): string | null {
	if (options.configPath !== undefined) {
		return resolve(cwd, options.configPath);
	}
	return findConfigFile(cwd);
}

/**
 * 個別commandを起動し、通常のengine選択ならundefinedを返す
 *
 * @param argv - CLIの起動引数
 * @param cwd - fileの相対pathを解決するdirectory
 * @returns 個別commandの終了code 通常のengine選択ならundefined
 */
function runSubcommand(argv: string[], cwd: string): number | undefined {
	const [subcommand, ...rest] = argv;
	if (subcommand === "document-style") {
		throw new Error("document-style has been renamed to markdown");
	}
	if (
		subcommand === "markdown" &&
		["scan", "check", "lint", "--help", "-h"].includes(rest[0] ?? "")
	) {
		return markdownMain(rest, cwd);
	}
	if (subcommand === "migrate") {
		return migrateMain(rest, cwd);
	}
	return undefined;
}

/**
 * CLIの本体を起動して終了codeを返す
 *
 * @param argv - 起動時に渡されたcommand line引数
 * @param cwd - configとbaselineを解決する作業ディレクトリ
 * @returns 処理結果を表す終了code
 */
export async function main(
	argv: string[],
	cwd = process.cwd(),
): Promise<number> {
	const subcommand = runSubcommand(argv, cwd);
	if (subcommand !== undefined) {
		return subcommand;
	}
	if (wantsHelp(argv)) {
		console.log(USAGE);
		return 0;
	}
	const options = parseArguments(argv);
	const color = colorEnabled(process.stdout, process.env);
	const paint = color ? ansiPainter() : plainPainter;
	const configPath = resolveConfigPath(options, cwd);
	if (configPath === null) {
		console.error(`quality.json not found in ${cwd}`);
		return 2;
	}
	const config = loadConfig(configPath);
	const selection = resolveRunSelection(options.targets, options.update);
	const baselinePath = resolveBaselinePath(options, config, cwd);
	const startedAt = performance.now();
	const results = await runEngines({
		baseline:
			options.update || baselinePath === null
				? null
				: readBaseline(baselinePath),
		color,
		config,
		cwd,
		overrides: { ignore: options.ignores, targets: selection.targets },
		selected: selection.selected,
	});
	const elapsedMs = performance.now() - startedAt;
	if (options.update) {
		if (baselinePath === null) {
			console.error("baseline is disabled by the configuration");
			return 2;
		}
		const baseline = createBaseline(
			results.flatMap((result) => result.detected),
		);
		writeBaseline(baselinePath, baseline);
		console.log(
			paint(
				`Recorded ${baseline.entries.length} entries in ${baselinePath}`,
				"pass",
			),
		);
		return 0;
	}
	if (options.json) {
		console.log(JSON.stringify(toJsonReport(results, elapsedMs), null, "\t"));
	} else {
		for (const result of results) {
			console.log(formatEngineSection(result, paint));
		}
		console.log(formatSummary(results, elapsedMs, paint));
	}
	return results.some((result) => result.status !== "passed") ? 1 : 0;
}

/**
 * CLIの本体を起動する launcherと直接実行の両方から呼ぶ
 */
export function run(): void {
	runCli(main);
}

if (import.meta.main) {
	run();
}
