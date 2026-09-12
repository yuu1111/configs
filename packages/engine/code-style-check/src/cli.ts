#!/usr/bin/env bun
import { parseArgv, runCli, wantsHelp } from "@yuu1111/shared/cli";
import { collectFiles, normalizePath } from "@yuu1111/shared/files";
import { formatLocation } from "@yuu1111/shared/findings";
import type { Finding } from "./rules";
import { SUPPORTED_EXTENSIONS, scanFiles } from "./scan";

const USAGE = "Usage: code-style-check [--ignore <path>] [--json] [path...]";

/**
 * 解析した起動条件
 */
export interface Options {
	ignores: string[];
	json: boolean;
	targets: string[];
}

/**
 * 起動条件を解析する
 *
 * @param argv - 解析するcommand line引数
 * @returns ignoreとjsonとtargetsを持つ起動条件
 */
export function parseArguments(argv: string[]): Options {
	const parsed = parseArgv(argv, {
		flags: ["json"],
		values: ["ignore"],
	});
	return {
		ignores: (parsed.values.get("ignore") ?? []).map(normalizePath),
		json: parsed.flags.has("json"),
		targets: parsed.targets.length > 0 ? parsed.targets : ["."],
	};
}

function describeFinding(finding: Finding): string {
	return `${formatLocation(finding)} ${finding.rule} ${finding.severity} ${finding.message}`;
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
	const findings = scanFiles(files);
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
