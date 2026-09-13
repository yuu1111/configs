#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { parseArgv, runCli, wantsHelp } from "@yuu1111/shared/cli";
import { collectFiles, normalizePath } from "@yuu1111/shared/files";
import { formatLocation } from "@yuu1111/shared/findings";
import { snapshot, verify } from "./audit";
import type { OptInRuleId, RuleId } from "./rule-ids";
import { type Finding, parseDisabledRules, parseEnabledRules } from "./rules";
import { DOCUMENT_EXTENSIONS, fixFiles, lintFiles } from "./scan";

type Action = "check" | "lint" | "scan";

/**
 * 解析した起動条件
 */
export interface Options {
	action: Action;
	disabled: RuleId[];
	enabled: OptInRuleId[];
	ignores: string[];
	json: boolean;
	review: string;
	rules: string;
	targets: string[];
	write: boolean;
}

const USAGE = [
	"使い方: document-style-check <scan|check|lint> [options] [path...]",
	"",
	"  scan  <path...> --rules <file> --review <file>   確認候補と検証記録を作る",
	"  check <path...> --rules <file> --review <file>   埋めた検証記録を確認する",
	"  lint  [--write] [--enable <rule>] [--disable <rule>] [--ignore <path>] [--json] [path...]",
	"                                                  機械的な違反を報告または整形する",
].join("\n");

/**
 * 行動を選ぶ位置引数を解析する
 */
function toAction(argument: string): Action | undefined {
	if (argument === "check" || argument === "lint" || argument === "scan") {
		return argument;
	}
	return undefined;
}

/**
 * 引数を解析し、行動と対象をまとめる
 *
 * @param argv - 起動時に渡されたcommand line引数
 * @returns 解析した行動・対象・optionの一覧
 */
export function parseArguments(argv: string[]): Options {
	const parsed = parseArgv(argv, {
		flags: ["json", "write"],
		values: ["disable", "enable", "ignore", "review", "rules"],
	});
	const [actionArgument, ...targets] = parsed.targets;
	if (actionArgument === undefined) {
		throw new Error(USAGE);
	}
	const action = toAction(actionArgument);
	if (action === undefined) {
		throw new Error(`unknown action: ${actionArgument}`);
	}
	const enabled = parseEnabledRules(parsed.values.get("enable") ?? []);
	return {
		action,
		disabled: parseDisabledRules(parsed.values.get("disable") ?? [], enabled),
		enabled,
		ignores: (parsed.values.get("ignore") ?? []).map(normalizePath),
		json: parsed.flags.has("json"),
		review: parsed.values.get("review")?.at(-1) ?? "",
		rules: parsed.values.get("rules")?.at(-1) ?? "",
		targets,
		write: parsed.flags.has("write"),
	};
}

/**
 * 検出を1行の文字列へ整える
 */
function describeFinding(finding: Finding): string {
	return `${formatLocation(finding)} ${finding.rule} ${finding.severity} ${finding.message}`;
}

/**
 * 対象のMarkdownを絶対pathの一覧にする
 */
function requireDocuments(options: Options): string[] {
	if (options.targets.length === 0) {
		throw new Error("対象のMarkdownを1つ以上指定してください");
	}
	return options.targets.map((target) => resolve(target));
}

/**
 * 判断基準のfileを必須にする
 */
function requireRules(options: Options): string {
	if (options.rules === "") {
		throw new Error("判断基準のfileを--rulesで指定してください");
	}
	return options.rules;
}

/**
 * 検証記録のfileを必須にする
 */
function requireReview(options: Options): string {
	if (options.review === "") {
		throw new Error("検証記録のfileを--reviewで指定してください");
	}
	return options.review;
}

/**
 * 対象文書の検証記録を書き出す
 */
function runScan(options: Options): number {
	const review = snapshot(requireDocuments(options), requireRules(options));
	const reviewPath = requireReview(options);
	writeFileSync(reviewPath, `${JSON.stringify(review, null, "\t")}\n`, {
		encoding: "utf8",
		flag: "wx",
	});
	const total = (
		select: (document: (typeof review.documents)[number]) => number,
	): number =>
		review.documents.reduce((sum, document) => sum + select(document), 0);
	console.log(
		`${review.criteria.length}基準・${total((document) => document.boundaries.length)}段落境界・${total((document) => document.lineBreaks.length)}単一改行・${total((document) => document.longLines.length)}長行を確認してください: ${reviewPath}`,
	);
	return 0;
}

/**
 * 埋めた検証記録を現在の本文と基準に対して確認する
 */
function runCheck(options: Options): number {
	const review: unknown = JSON.parse(
		readFileSync(requireReview(options), "utf8").replace(/^\uFEFF/, ""),
	);
	const errors = verify(
		requireDocuments(options),
		review,
		requireRules(options),
	);
	if (errors.length > 0) {
		console.error(errors.join("\n"));
		return 1;
	}
	console.log(
		"現在の本文に対する確認記録が揃っています。文体判断の正しさは別途確認が必要です。",
	);
	return 0;
}

/**
 * 検出と整形の結果を出力し、errorの有無を終了codeで返す
 */
function report(options: Options, files: string[]): number {
	const findings = lintFiles(
		files,
		process.cwd(),
		options.enabled,
		options.disabled,
	);
	const errors = findings.filter((finding) => finding.severity === "error");
	const warnings = findings.filter((finding) => finding.severity === "warning");
	if (options.json) {
		console.log(JSON.stringify({ errors, warnings }, null, "\t"));
		return errors.length > 0 ? 1 : 0;
	}
	for (const finding of [...errors, ...warnings]) {
		console.log(describeFinding(finding));
	}
	console.log(
		`Checked ${files.length} files: ${errors.length} errors, ${warnings.length} warnings`,
	);
	return errors.length > 0 ? 1 : 0;
}

/**
 * 機械的な違反を報告し、--writeでは整形する
 */
function runLint(options: Options): number {
	const targets = options.targets.length > 0 ? options.targets : ["."];
	const files = collectFiles(targets, {
		cwd: process.cwd(),
		extensions: DOCUMENT_EXTENSIONS,
		ignores: options.ignores,
	});
	if (options.write) {
		for (const file of fixFiles(files, options.enabled, options.disabled)) {
			console.log(`Fixed ${normalizePath(relative(process.cwd(), file))}`);
		}
	}
	return report(options, files);
}

/**
 * 引数に応じた処理を実行し、終了codeを返す
 *
 * @param argv - 起動時に渡されたcommand line引数
 * @returns 処理結果を表す終了code
 */
export function main(argv: string[]): number {
	if (wantsHelp(argv)) {
		console.log(USAGE);
		return 0;
	}
	const options = parseArguments(argv);
	if (options.action === "scan") {
		return runScan(options);
	}
	if (options.action === "check") {
		return runCheck(options);
	}
	return runLint(options);
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
