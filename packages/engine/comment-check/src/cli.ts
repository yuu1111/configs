#!/usr/bin/env bun
import {
	compareWithBaseline,
	createBaseline,
	readBaseline,
	writeBaseline,
} from "@yuu1111/shared/baseline";
import { parseArgv, runCli, wantsHelp } from "@yuu1111/shared/cli";
import { collectFiles, normalizePath } from "@yuu1111/shared/files";
import { formatLocation } from "@yuu1111/shared/findings";
import type { OptInRuleId, RuleId } from "./rule-ids";
import { type Finding, parseDisabledRules, parseEnabledRules } from "./rules";
import { SUPPORTED_EXTENSIONS, scanFiles } from "./scan";

const DEFAULT_BASELINE = "comment-baseline.json";

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
	"Usage: comment-check [--baseline <path>] [--enable <rule>] [--disable <rule>] [--ignore <path>] [--update-baseline] [--json] [path...]";

/**
 * 解析した起動条件
 */
export interface Options {
	baselinePath: string;
	disabled: RuleId[];
	enabled: OptInRuleId[];
	ignores: string[];
	json: boolean;
	targets: string[];
	update: boolean;
}

/**
 * 起動条件を解析する --enableのrule名はここで検証する
 *
 * @param argv - 解析するコマンドライン引数
 * @returns 解析した起動条件
 */
export function parseArguments(argv: string[]): Options {
	const parsed = parseArgv(argv, {
		flags: ["json", "update-baseline"],
		values: ["baseline", "disable", "enable", "ignore"],
	});
	const enabled = parseEnabledRules(parsed.values.get("enable") ?? []);
	return {
		baselinePath: parsed.values.get("baseline")?.at(-1) ?? DEFAULT_BASELINE,
		disabled: parseDisabledRules(parsed.values.get("disable") ?? [], enabled),
		enabled,
		ignores: (parsed.values.get("ignore") ?? []).map(normalizePath),
		json: parsed.flags.has("json"),
		targets: parsed.targets.length > 0 ? parsed.targets : ["."],
		update: parsed.flags.has("update-baseline"),
	};
}

function describeFinding(finding: Finding): string {
	const message = RULE_MESSAGES[finding.rule] ?? "";
	return `${formatLocation(finding)} ${finding.rule} ${message}`.trimEnd();
}

/**
 * 引数に応じて検査を実行し、終了codeを返す
 *
 * @param argv - コマンドライン引数の一覧
 * @returns 違反が追加されたときは1 それ以外は0
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
	const findings = scanFiles(
		files,
		process.cwd(),
		options.enabled,
		options.disabled,
	);
	if (options.update) {
		const baseline = createBaseline(findings);
		writeBaseline(options.baselinePath, baseline);
		console.log(
			`Recorded ${baseline.entries.length} entries in ${options.baselinePath}`,
		);
		return 0;
	}
	const baseline = readBaseline(options.baselinePath, "comment");
	const comparison = compareWithBaseline(findings, baseline);
	if (options.json) {
		console.log(
			JSON.stringify(
				{ added: comparison.added, resolved: comparison.resolved },
				null,
				"\t",
			),
		);
	} else {
		for (const finding of comparison.added) {
			console.log(describeFinding(finding));
		}
		console.log(
			`Checked ${files.length} files: ${comparison.added.length} new, ${comparison.resolved.length} resolved, ${baseline.entries.length} baselined`,
		);
	}
	return comparison.added.length > 0 ? 1 : 0;
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
