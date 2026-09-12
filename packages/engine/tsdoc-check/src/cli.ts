#!/usr/bin/env bun
import { parseArgv, runCli, wantsHelp } from "@yuu1111/shared/cli";
import { collectFiles, normalizePath } from "@yuu1111/shared/files";
import { formatLocation } from "@yuu1111/shared/findings";
import {
	type Finding,
	KNOWN_RULE_NAMES,
	type OptInRuleId,
	parseEnabledRules,
	promoteFindings,
} from "./rules";
import { scanFiles, TYPESCRIPT_EXTENSIONS } from "./scan";

const USAGE =
	"Usage: tsdoc-check [--enable <rule>] [--error <rule>] [--ignore <path>] [--json] [path...]";

interface Options {
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
		values: ["enable", "error", "ignore"],
	});
	const options: Options = {
		enabled: parseEnabledRules(parsed.values.get("enable") ?? []),
		ignores: (parsed.values.get("ignore") ?? []).map(normalizePath),
		json: parsed.flags.has("json"),
		promote: [],
		targets: parsed.targets.length > 0 ? parsed.targets : ["."],
	};
	for (const value of parsed.values.get("error") ?? []) {
		applyPromoteOption(options, value);
	}
	return options;
}

function describeFinding(finding: Finding): string {
	return `${formatLocation(finding)} ${finding.rule} ${finding.severity} ${finding.message}`;
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
		scanFiles(files, process.cwd(), options.enabled),
		options.promote,
	);
	const errors = findings.filter((finding) => finding.severity === "error");
	const warnings = findings.filter((finding) => finding.severity === "warning");
	if (options.json) {
		console.log(JSON.stringify({ errors, warnings }, null, "\t"));
	} else {
		for (const finding of [...errors, ...warnings]) {
			console.log(describeFinding(finding));
		}
		console.log(
			`Checked ${files.length} files: ${errors.length} errors, ${warnings.length} warnings`,
		);
	}
	return errors.length > 0 ? 1 : 0;
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
