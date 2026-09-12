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
 */
export function formatLocation(finding: Located): string {
	return `${finding.file}:${finding.line}:${finding.column}`;
}
