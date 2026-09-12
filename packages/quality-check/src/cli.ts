#!/usr/bin/env bun
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createBaseline, readBaseline, writeBaseline } from "./baseline";
import { ansiPainter, colorEnabled, plainPainter } from "./color";
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

function applyFlagOption(options: Options, argument: string): boolean {
	if (argument === "--json") {
		options.json = true;
		return true;
	}
	if (argument === "--update-baseline") {
		options.update = true;
		return true;
	}
	return false;
}

function applyValueOption(
	options: Options,
	argument: string,
	argv: string[],
	index: number,
): number | null {
	if (argument === "--config") {
		options.configPath = argv[index + 1];
		return 1;
	}
	if (argument.startsWith("--config=")) {
		options.configPath = argument.slice("--config=".length);
		return 0;
	}
	if (argument === "--baseline") {
		options.baselinePath = argv[index + 1];
		return 1;
	}
	if (argument.startsWith("--baseline=")) {
		options.baselinePath = argument.slice("--baseline=".length);
		return 0;
	}
	if (argument === "--ignore") {
		const value = argv[index + 1];
		if (value !== undefined) {
			options.ignores.push(value);
		}
		return 1;
	}
	if (argument.startsWith("--ignore=")) {
		options.ignores.push(argument.slice("--ignore=".length));
		return 0;
	}
	return null;
}

function parseArguments(argv: string[]): Options {
	const options: Options = {
		baselinePath: undefined,
		configPath: undefined,
		ignores: [],
		json: false,
		targets: [],
		update: false,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index] ?? "";
		const consumed = applyValueOption(options, argument, argv, index);
		if (consumed !== null) {
			index += consumed;
			continue;
		}
		if (applyFlagOption(options, argument)) {
			continue;
		}
		if (argument.startsWith("-")) {
			throw new Error(`unknown option: ${argument}`);
		}
		options.targets.push(argument);
	}
	return options;
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
	if (argv.includes("--help") || argv.includes("-h")) {
		console.log(USAGE);
		return 0;
	}
	const options = parseArguments(argv);
	const color = colorEnabled(process.stdout, process.env);
	const paint = color ? ansiPainter() : plainPainter;
	const cwd = process.cwd();
	const configPath = resolveConfigPath(options, cwd);
	if (configPath === null) {
		console.error(`quality.config.ts not found in ${cwd}`);
		return 2;
	}
	const config = await loadConfig(configPath);
	const baselinePath = resolveBaselinePath(options, config, cwd);
	const results = await runEngines({
		baseline:
			options.update || baselinePath === null
				? null
				: readBaseline(baselinePath),
		color,
		config,
		cwd,
		overrides: { ignore: options.ignores, targets: options.targets },
		rawBaseline: join(tmpdir(), `quality-check-raw-${process.pid}.json`),
	});
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
		console.log(JSON.stringify(toJsonReport(results), null, "\t"));
	} else {
		for (const result of results) {
			console.log(formatEngineSection(result, paint));
		}
		console.log(formatSummary(results, paint));
	}
	return results.some((result) => result.status !== "passed") ? 1 : 0;
}

try {
	process.exit(await main(process.argv.slice(2)));
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(2);
}
