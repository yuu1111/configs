#!/usr/bin/env bun
import { parseArgv, runCli, wantsHelp } from "@yuu1111/shared/cli";
import { collectFiles, normalizePath } from "@yuu1111/shared/files";
import {
	describeReportFinding,
	formatReportSummary,
	printReport,
	toReport,
} from "@yuu1111/shared/report";
import type { OptInRuleId, RuleId } from "./rule-ids";
import { type Finding, parseDisabledRules, parseEnabledRules } from "./rules";
import { SUPPORTED_EXTENSIONS, scanFiles } from "./scan";

const RULE_MESSAGES: Record<string, string> = {
	"broad-suppression": "file-wide suppression hides too much",
	"cramped-comment": "a multi-line comment needs a blank line before it",
	"japanese-period":
		"a Japanese sentence in a comment does not end with a period",
	"placeholder-comment": "placeholder comment should be resolved or tracked",
	"separator-comment": "decorative separator comment adds no information",
	"undocumented-directive": "TypeScript directive needs a description",
};

const USAGE =
	"Usage: comment-check [--enable <rule>] [--disable <rule>] [--ignore <path>] [--json] [path...]";

/**
 * 解析した起動条件
 */
export interface Options {
	disabled: RuleId[];
	enabled: OptInRuleId[];
	ignores: string[];
	json: boolean;
	targets: string[];
}

/**
 * 起動条件を解析する --enableのrule名はここで検証する
 *
 * @param argv - 解析するコマンドライン引数
 * @returns 解析した起動条件
 */
export function parseArguments(argv: string[]): Options {
	const parsed = parseArgv(argv, {
		flags: ["json"],
		values: ["disable", "enable", "ignore"],
	});
	const enabled = parseEnabledRules(parsed.values.get("enable") ?? []);
	return {
		disabled: parseDisabledRules(parsed.values.get("disable") ?? [], enabled),
		enabled,
		ignores: (parsed.values.get("ignore") ?? []).map(normalizePath),
		json: parsed.flags.has("json"),
		targets: parsed.targets.length > 0 ? parsed.targets : ["."],
	};
}

/**
 * 検出をengineの報告へ変換する ruleごとの説明をmessageへ載せる
 *
 * @param findings - 報告へ載せる検出
 * @returns severityとmessageを補った報告
 */
function toEngineReport(findings: readonly Finding[]) {
	return toReport(
		findings.map((finding) => ({
			column: finding.column,
			file: finding.file,
			line: finding.line,
			message: RULE_MESSAGES[finding.rule] ?? "",
			rule: finding.rule,
			severity: "error",
		})),
	);
}

/**
 * 引数に応じて検査を実行し、終了codeを返す
 *
 * @param argv - コマンドライン引数の一覧
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
	const report = toEngineReport(
		scanFiles(files, process.cwd(), options.enabled, options.disabled),
	);
	if (options.json) {
		printReport(report);
	} else {
		for (const finding of report.errors) {
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
