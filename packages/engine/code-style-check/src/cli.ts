#!/usr/bin/env bun
import { parseArgv, runCli, wantsHelp } from "@yuu1111/shared/cli";
import { collectFiles, normalizePath } from "@yuu1111/shared/files";
import {
	describeReportFinding,
	formatReportSummary,
	printReport,
	toReport,
} from "@yuu1111/shared/report";
import type { RuleId } from "./rule-ids";
import { type Finding, parseDisabledRules } from "./rules";
import { SUPPORTED_EXTENSIONS, scanFiles } from "./scan";

const USAGE =
	"Usage: code-style-check [--disable <rule>] [--ignore <path>] [--json] [path...]";

/**
 * 解析した起動条件
 */
export interface Options {
	disabled: RuleId[];
	ignores: string[];
	json: boolean;
	targets: string[];
}

/**
 * 起動条件を解析する
 *
 * @param argv - 解析するcommand line引数
 * @returns disableとignoreとjsonとtargetsを持つ起動条件
 */
export function parseArguments(argv: string[]): Options {
	const parsed = parseArgv(argv, {
		flags: ["json"],
		values: ["disable", "ignore"],
	});
	return {
		disabled: parseDisabledRules(parsed.values.get("disable") ?? []),
		ignores: (parsed.values.get("ignore") ?? []).map(normalizePath),
		json: parsed.flags.has("json"),
		targets: parsed.targets.length > 0 ? parsed.targets : ["."],
	};
}

/**
 * 引数に応じて検査を実行し、終了codeを返す
 *
 * @param argv - 起動条件として解析するcommand line引数
 * @returns 検出したerrorが無ければ0、あれば1の終了code
 */
export function main(argv: string[]): number {
	if (wantsHelp(argv)) {
		console.log(USAGE);
		return 0;
	}
	const options = parseArguments(argv);
	const files = collectFiles(options.targets, {
		cwd: process.cwd(),
		extensions: SUPPORTED_EXTENSIONS,
		ignores: options.ignores,
	});
	const findings: Finding[] = scanFiles(files, process.cwd(), options.disabled);
	const report = toReport(findings);
	if (options.json) {
		printReport(report);
	} else {
		for (const finding of [...report.errors, ...report.warnings]) {
			console.log(describeReportFinding(finding));
		}
		console.log(formatReportSummary(files.length, report));
	}
	return report.errors.length > 0 ? 1 : 0;
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
