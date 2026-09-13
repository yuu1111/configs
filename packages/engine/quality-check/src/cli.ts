#!/usr/bin/env bun
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
	createBaseline,
	readBaseline,
	writeBaseline,
} from "@yuu1111/shared/baseline";
import { parseArgv, runCli, wantsHelp } from "@yuu1111/shared/cli";
import { ansiPainter, colorEnabled, plainPainter } from "@yuu1111/shared/color";
import {
	DEFAULT_BASELINE_FILE,
	findConfigFile,
	loadConfig,
	type QualityConfig,
} from "./config";
import { formatEngineSection, formatSummary, toJsonReport } from "./report";
import { runEngines } from "./run";

const USAGE =
	"Usage: quality-check [--config <path>] [--baseline <path>] [--ignore <path>] [--update-baseline] [--json] [path...]";

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

async function main(argv: string[]): Promise<number> {
	if (wantsHelp(argv)) {
		console.log(USAGE);
		return 0;
	}
	const options = parseArguments(argv);
	const color = colorEnabled(process.stdout, process.env);
	const paint = color ? ansiPainter() : plainPainter;
	const cwd = process.cwd();
	const configPath = resolveConfigPath(options, cwd);
	if (configPath === null) {
		console.error(`quality.json not found in ${cwd}`);
		return 2;
	}
	const config = loadConfig(configPath);
	const baselinePath = resolveBaselinePath(options, config, cwd);
	const startedAt = performance.now();
	const results = await runEngines({
		baseline:
			options.update || baselinePath === null
				? null
				: readBaseline(baselinePath, "quality"),
		color,
		config,
		cwd,
		overrides: { ignore: options.ignores, targets: options.targets },
		rawBaseline: join(tmpdir(), `quality-check-raw-${process.pid}.json`),
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
