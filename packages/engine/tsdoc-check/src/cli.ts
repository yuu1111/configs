#!/usr/bin/env bun
import { parseArgv, runCli, wantsHelp } from "@yuu1111/shared/cli";
import { collectFiles, normalizePath } from "@yuu1111/shared/files";
import {
	describeReportFinding,
	formatReportSummary,
	printReport,
	toReport,
} from "@yuu1111/shared/report";
import { KNOWN_RULE_NAMES, type OptInRuleId, type TsdocRule } from "./rule-ids";
import {
	parseDisabledRules,
	parseEnabledRules,
	promoteFindings,
} from "./rules";
import { scanFiles, TYPESCRIPT_EXTENSIONS } from "./scan";

const USAGE =
	"Usage: tsdoc-check [--enable <rule>] [--disable <rule>] [--error <rule>] [--ignore <path>] [--json] [path...]";

interface Options {
	disabled: TsdocRule[];
	enabled: OptInRuleId[];
	ignores: string[];
	json: boolean;
	promote: string[];
	targets: string[];
}

function applyPromoteOption(options: Options, value: string): void {
	if (!KNOWN_RULE_NAMES.includes(value as (typeof KNOWN_RULE_NAMES)[number])) {
		throw new Error(`unknown rule: ${value}`);
	}
	options.promote.push(value);
}

function parseArguments(argv: string[]): Options {
	const parsed = parseArgv(argv, {
		flags: ["json"],
		values: ["disable", "enable", "error", "ignore"],
	});
	const options: Options = {
		disabled: [],
		enabled: parseEnabledRules(parsed.values.get("enable") ?? []),
		ignores: (parsed.values.get("ignore") ?? []).map(normalizePath),
		json: parsed.flags.has("json"),
		promote: [],
		targets: parsed.targets.length > 0 ? parsed.targets : ["."],
	};
	for (const value of parsed.values.get("error") ?? []) {
		applyPromoteOption(options, value);
	}
	options.disabled = parseDisabledRules(
		parsed.values.get("disable") ?? [],
		options.enabled,
		options.promote,
	);
	return options;
}

function main(argv: string[]): number {
	if (wantsHelp(argv)) {
		console.log(USAGE);
		return 0;
	}
	const options = parseArguments(argv);
	const files = collectFiles(options.targets, {
		cwd: process.cwd(),
		extensions: TYPESCRIPT_EXTENSIONS,
		ignores: options.ignores,
	});
	const findings = promoteFindings(
		scanFiles(files, process.cwd(), options.enabled, options.disabled),
		options.promote,
	);
	const result = toReport(findings);
	if (options.json) {
		printReport(result);
	} else {
		for (const finding of [...result.errors, ...result.warnings]) {
			console.log(describeReportFinding(finding));
		}
		console.log(formatReportSummary(files.length, result));
	}
	return result.errors.length > 0 ? 1 : 0;
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
