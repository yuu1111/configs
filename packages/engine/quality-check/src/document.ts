import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { snapshot, verify } from "@yuu1111/document-style-check/audit";
import { fix } from "@yuu1111/document-style-check/fix";
import { inspect } from "@yuu1111/document-style-check/run";
import { parseArgv, wantsHelp } from "@yuu1111/shared/cli";
import { normalizePath } from "@yuu1111/shared/files";
import {
	describeReportFinding,
	formatReportSummary,
	printReport,
} from "@yuu1111/shared/report";
import { RULE_VOCABULARY } from "./config";

type Action = "check" | "lint" | "scan";

/**
 * 解析した起動条件
 */
export interface DocumentOptions {
	action: Action;
	disabled: string[];
	enabled: string[];
	ignores: string[];
	json: boolean;
	review: string;
	rules: string;
	targets: string[];
	write: boolean;
}

const USAGE = [
	"使い方: quality-check document-style <scan|check|lint> [options] [path...]",
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
 * --enableで渡されたrule名を検証して重複を除く
 *
 * @param values - --enableで指定されたrule名の一覧
 * @returns 検証を通ったopt-in ruleの識別子
 */
function parseEnabledRules(values: readonly string[]): string[] {
	const optIn: readonly string[] =
		RULE_VOCABULARY["document-style-check"].optIn;
	const enabled: string[] = [];
	for (const value of values) {
		if (!optIn.includes(value)) {
			throw new Error(`unknown rule: ${value}`);
		}
		if (!enabled.includes(value)) {
			enabled.push(value);
		}
	}
	return enabled;
}

/**
 * --disableで渡されたrule名を検証して重複を除く --enableで有効にしたruleは無効にできない
 *
 * @param values - --disableで指定されたrule名の一覧
 * @param enabled - --enableで有効にしたopt-in ruleの一覧
 * @returns 検証済みで重複のない無効化するruleの一覧
 */
function parseDisabledRules(
	values: readonly string[],
	enabled: readonly string[],
): string[] {
	const all: readonly string[] = RULE_VOCABULARY["document-style-check"].all;
	const disabled: string[] = [];
	for (const value of values) {
		if (!all.includes(value)) {
			throw new Error(`unknown rule: ${value}`);
		}
		if (enabled.includes(value)) {
			throw new Error(`a rule cannot be enabled and disabled: ${value}`);
		}
		if (!disabled.includes(value)) {
			disabled.push(value);
		}
	}
	return disabled;
}

/**
 * 引数を解析し、行動と対象をまとめる
 *
 * @param argv - 起動時に渡されたcommand line引数
 * @returns 解析した行動・対象・optionの一覧
 */
export function parseArguments(argv: string[]): DocumentOptions {
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
 * 対象のMarkdownを絶対pathの一覧にする
 */
function requireDocuments(options: DocumentOptions): string[] {
	if (options.targets.length === 0) {
		throw new Error("対象のMarkdownを1つ以上指定してください");
	}
	return options.targets.map((target) => resolve(target));
}

/**
 * 判断基準のfileを必須にする
 */
function requireRules(options: DocumentOptions): string {
	if (options.rules === "") {
		throw new Error("判断基準のfileを--rulesで指定してください");
	}
	return options.rules;
}

/**
 * 検証記録のfileを必須にする
 */
function requireReview(options: DocumentOptions): string {
	if (options.review === "") {
		throw new Error("検証記録のfileを--reviewで指定してください");
	}
	return options.review;
}

/**
 * 対象文書の検証記録を書き出す
 */
function runScan(options: DocumentOptions): number {
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
function runCheck(options: DocumentOptions): number {
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
 * 機械的な違反を報告し、--writeでは整形する
 */
function runLint(options: DocumentOptions): number {
	const context = {
		cwd: process.cwd(),
		includes: [
			"**",
			...options.ignores.flatMap((path) => [`!${path}`, `!${path}/**`]),
		],
		rules: {
			disable: options.disabled,
			enable: options.enabled,
			error: [],
			warn: [],
		},
		targets: options.targets.length > 0 ? options.targets : ["."],
	};
	if (options.write) {
		for (const file of fix(context)) {
			console.log(`Fixed ${normalizePath(relative(context.cwd, file))}`);
		}
	}
	const { files, report } = inspect(context);
	if (options.json) {
		printReport(report);
		return report.errors.length > 0 ? 1 : 0;
	}
	for (const finding of [...report.errors, ...report.warnings]) {
		console.log(describeReportFinding(finding));
	}
	console.log(formatReportSummary(files.length, report));
	return report.errors.length > 0 ? 1 : 0;
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
