/**
 * 指摘の重大度
 */
export type Severity = "error" | "warning";

/**
 * 指摘のfileと位置
 */
export interface Located {
	column: number;
	file: string;
	line: number;
}

/**
 * 指摘をfile順と位置順に並べる
 *
 * @param left - 比較する一方の指摘
 * @param right - 比較するもう一方の指摘
 * @returns file順、line順、column順でleftが先なら負、rightが先なら正、同じなら0
 */
export function compareFindings(left: Located, right: Located): number {
	if (left.file !== right.file) {
		return left.file < right.file ? -1 : 1;
	}
	if (left.line !== right.line) {
		return left.line - right.line;
	}
	return left.column - right.column;
}

/**
 * 指摘の位置をfile:line:columnの形へ整える
 *
 * @param finding - 位置を整形する指摘
 * @returns file:line:columnの形にした文字列
 */
export function formatLocation(finding: Located): string {
	return `${finding.file}:${finding.line}:${finding.column}`;
}
