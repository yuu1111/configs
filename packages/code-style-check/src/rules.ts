import type { Located, Severity } from "@yuu1111/shared/findings";

/**
 * code-style-checkが報告するruleの識別子一覧
 */
export const RULE_IDS = ["blank-line-between-functions"] as const;

/**
 * RULE_IDSが定義するrule識別子のunion型
 */
export type RuleId = (typeof RULE_IDS)[number];

/**
 * 検出したstyle違反1件の内容と位置
 */
export interface Finding extends Located {
	message: string;
	rule: RuleId;
	severity: Severity;
}

/**
 * 関数定義の間隔に必要な空行の数
 */
export const REQUIRED_BLANK_LINES = 1;

/**
 * 定義の終端と次の定義の開始の間で連続する空行の最大数を数える
 * 間にあるcommentの行は空行として数えず、空行の連続を途切れさせる
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
 */
export function classifyGap(
	blankLines: number,
	name: string,
): { message: string; severity: Severity } | null {
	if (blankLines === REQUIRED_BLANK_LINES) {
		return null;
	}
	if (blankLines === 0) {
		return {
			message: `the function definition ${name} needs a single blank line before it`,
			severity: "error",
		};
	}
	return {
		message: `the function definition ${name} has more than one blank line before it`,
		severity: "warning",
	};
}
