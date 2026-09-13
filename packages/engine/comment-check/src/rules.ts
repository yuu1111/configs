import type { Located } from "@yuu1111/shared/findings";
import {
	OPT_IN_RULE_IDS,
	type OptInRuleId,
	RULE_IDS,
	type RuleId,
} from "./rule-ids";

/**
 * 検出したcomment違反1件の内容と位置
 */
export interface Finding extends Located {
	rule: RuleId;
	text: string;
}

const PLACEHOLDER_PATTERN = /\b(TODO|FIXME|XXX|HACK)\b/;
const SEPARATOR_PATTERN = /^[-=*_#~+./\\|]{4,}$/;
const DIRECTIVE_PATTERN = /^@ts-(?:ignore|expect-error)\b([\s\S]*)$/;
const JAPANESE_PERIOD = "。";
const BLOCK_OPENER = /(?:=>|[{(,[])\s*$/;
const COMMENT_CONTINUATION = /^(?:\/\/|\*|\/\*)/;

/**
 * --enableの値を検証して重複を除く 未知のrule名は設定errorにする
 *
 * @param values - --enableで指定されたrule名の一覧
 * @returns 検証済みで重複のないopt-in ruleの一覧
 */
export function parseEnabledRules(values: readonly string[]): OptInRuleId[] {
	const enabled: OptInRuleId[] = [];
	for (const value of values) {
		if (!(OPT_IN_RULE_IDS as readonly string[]).includes(value)) {
			throw new Error(`unknown rule: ${value}`);
		}
		const rule = value as OptInRuleId;
		if (!enabled.includes(rule)) {
			enabled.push(rule);
		}
	}
	return enabled;
}

/**
 * --disableで渡されたrule名を検証して重複を除く --enableで有効にしたruleは無効にできない
 *
 * @param values - --disableで渡されたrule名の一覧
 * @param enabled - --enableで有効にしたopt-in ruleの一覧
 * @returns 検証済みで重複のない無効化するruleの一覧
 */
export function parseDisabledRules(
	values: readonly string[],
	enabled: readonly OptInRuleId[] = [],
): RuleId[] {
	const disabled: RuleId[] = [];
	for (const value of values) {
		if (!(RULE_IDS as readonly string[]).includes(value)) {
			throw new Error(`unknown rule: ${value}`);
		}
		const rule = value as RuleId;
		if ((enabled as readonly string[]).includes(rule)) {
			throw new Error(`a rule cannot be enabled and disabled: ${value}`);
		}
		if (!disabled.includes(rule)) {
			disabled.push(rule);
		}
	}
	return disabled;
}

/**
 * comment原文にある最初の日本語句点の位置を返す 無ければ-1を返す
 *
 * @param text - 日本語句点を探すcomment本文
 * @returns 最初の日本語句点の位置 無ければ-1
 */
export function findJapanesePeriod(text: string): number {
	return text.indexOf(JAPANESE_PERIOD);
}

/**
 * 行頭のcommentが直前の行へ空行なしで続いているか判定する
 *
 * @param source - commentを含むsource文字列
 * @param start - 判定するcommentの開始位置
 * @returns 空行なしで続いているときはtrue
 */
export function isCrampedComment(source: string, start: number): boolean {
	const lineStart = source.lastIndexOf("\n", start - 1) + 1;
	if (lineStart === 0 || source.slice(lineStart, start).trim() !== "") {
		return false;
	}
	const previousEnd = lineStart - 1;
	const previousStart = source.lastIndexOf("\n", previousEnd - 1) + 1;
	const previous = source.slice(previousStart, previousEnd).trim();
	if (previous === "" || previous.endsWith("*/")) {
		return false;
	}
	return !(COMMENT_CONTINUATION.test(previous) || BLOCK_OPENER.test(previous));
}

/**
 * block commentの記号を除いて空白を揃えた本文を返す
 *
 * @param body - 記号を除く前のcomment本文
 * @returns 空白を揃えたcomment本文
 */
export function normalizeComment(body: string): string {
	return body
		.split("\n")
		.map((line) => line.replace(/^\s*\*+\s?/, ""))
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * comment本文を分類し、該当するruleがなければnullを返す
 *
 * @param body - 分類するcomment本文
 * @returns 該当するruleの識別子 該当しなければnull
 */
export function classifyComment(body: string): RuleId | null {
	const text = normalizeComment(body);
	if (text === "") {
		return null;
	}
	if (
		/^(?:biome-ignore-all|@ts-nocheck)\b/.test(text) ||
		/^eslint-disable(?:-next-line|-line)?\s*$/.test(text)
	) {
		return "broad-suppression";
	}
	const directive = DIRECTIVE_PATTERN.exec(text);
	if (directive) {
		return (directive[1] ?? "").replace(/^[\s:—-]+/, "") === ""
			? "undocumented-directive"
			: null;
	}
	if (PLACEHOLDER_PATTERN.test(text)) {
		return "placeholder-comment";
	}
	if (SEPARATOR_PATTERN.test(text)) {
		return "separator-comment";
	}
	return null;
}
