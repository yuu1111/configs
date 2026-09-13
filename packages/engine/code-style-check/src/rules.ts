import type { Located, Severity } from "@yuu1111/shared/findings";
import { RULE_IDS, type RuleId } from "./rule-ids";

/**
 * 空行で区切る対象になる定義の種類
 */
export type DefinitionKind =
	| "class"
	| "constructor"
	| "enum"
	| "function"
	| "getter"
	| "interface"
	| "method"
	| "namespace"
	| "property"
	| "setter"
	| "type"
	| "variable";

/**
 * 検出したstyle違反1件の内容と位置
 */
export interface Finding extends Located {
	message: string;
	rule: RuleId;
	severity: Severity;
}

/**
 * --disableで渡されたrule名を検証して重複を除く
 *
 * @param values - --disableで指定されたrule名の一覧
 * @returns 検証済みで重複のない無効化するruleの一覧
 */
export function parseDisabledRules(values: readonly string[]): RuleId[] {
	const disabled: RuleId[] = [];
	for (const value of values) {
		if (!(RULE_IDS as readonly string[]).includes(value)) {
			throw new Error(`unknown rule: ${value}`);
		}
		const rule = value as RuleId;
		if (!disabled.includes(rule)) {
			disabled.push(rule);
		}
	}
	return disabled;
}

/**
 * 隣り合う定義の間に必要な空行の数
 */
export const REQUIRED_BLANK_LINES = 1;

/**
 * 定義の種類ごとにmessageへ載せる呼び名
 */
const KIND_LABELS: Record<DefinitionKind, string> = {
	class: "class definition",
	constructor: "constructor",
	enum: "enum definition",
	function: "function definition",
	getter: "getter definition",
	interface: "interface definition",
	method: "method definition",
	namespace: "namespace definition",
	property: "property declaration",
	setter: "setter definition",
	type: "type definition",
	variable: "variable declaration",
};

/**
 * 定義の種類と名前からmessageへ載せる呼び名を組み立てる
 *
 * @param kind - 呼び名を組み立てる定義の種類
 * @param name - 呼び名へ続ける定義の名前
 * @returns 種類と名前を組み合わせた呼び名
 */
export function describeDefinition(kind: DefinitionKind, name: string): string {
	const label = KIND_LABELS[kind];
	return kind === "constructor" ? label : `${label} ${name}`;
}

/**
 * 隣り合う定義の組が空行を要求するか判定する
 * 同じ種類の変数宣言とclass propertyを並べた組だけは、まとまりとして書けるように要求しない
 *
 * @param previous - 組の前にある定義の種類
 * @param next - 組の後ろにある定義の種類
 * @returns 空行を要求するならtrue、まとめて書ける組ならfalse
 */
export function requiresBlankLine(
	previous: DefinitionKind,
	next: DefinitionKind,
): boolean {
	const groupable = previous === "variable" || previous === "property";
	return previous !== next || !groupable;
}

/**
 * 隣り合う定義の組を報告するruleの識別子を求める
 *
 * @param previous - 組の前にある定義の種類
 * @param next - 組の後ろにある定義の種類
 * @returns propertyが絡む組ならclass member用、それ以外はdefinition用の識別子
 */
export function ruleFor(
	previous: DefinitionKind,
	next: DefinitionKind,
): RuleId {
	return previous === "property" || next === "property"
		? "blank-line-between-class-members"
		: "blank-line-between-definitions";
}

/**
 * 定義の終端と次の定義の開始の間で連続する空行の最大数を数える
 * 間にあるcommentの行は空行として数えず、空行の連続を途切れさせる
 *
 * @param source - 空行を数える対象のsource文字列
 * @param previousEnd - 直前の定義の終端offset
 * @param nextStart - 次の定義の開始offset
 * @returns 連続する空行の最大数
 */
export function countBlankLines(
	source: string,
	previousEnd: number,
	nextStart: number,
): number {
	const lines = source.slice(previousEnd, nextStart).split("\n").slice(1, -1);
	let longest = 0;
	let current = 0;
	for (const line of lines) {
		current = line.trim() === "" ? current + 1 : 0;
		longest = Math.max(longest, current);
	}
	return longest;
}

/**
 * 空行の数から違反の内容と重大度を求める 適切ならnullを返す
 *
 * @param blankLines - 隣接する定義の間に見つかった空行の数
 * @param kind - 違反messageに載せる次の定義の種類
 * @param name - 違反messageに載せる次の定義の名前
 * @returns 違反のmessageとseverity、間隔が適切ならnull
 */
export function classifyGap(
	blankLines: number,
	kind: DefinitionKind,
	name: string,
): { message: string; severity: Severity } | null {
	if (blankLines === REQUIRED_BLANK_LINES) {
		return null;
	}
	const definition = describeDefinition(kind, name);
	if (blankLines === 0) {
		return {
			message: `the ${definition} needs a single blank line before it`,
			severity: "error",
		};
	}
	return {
		message: `the ${definition} has more than one blank line before it`,
		severity: "warning",
	};
}
