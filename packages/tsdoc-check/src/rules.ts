import { type Declaration, type Position, positionAt } from "./parse";
import { parseTsdoc } from "./tsdoc";

export type TsdocRule =
	| "missing-doc"
	| "param-mismatch"
	| "tsdoc-syntax"
	| "tsdoc-tag"
	| "type-param-mismatch";
export type Severity = "error" | "warning";

/** TSDocに定義がないtagは構文errorではなく報告に留める */
const TAG_MESSAGE_IDS = new Set(["tsdoc-undefined-tag"]);

export interface Finding {
	column: number;
	file: string;
	line: number;
	message: string;
	rule: TsdocRule;
	severity: Severity;
}

function finding(
	rule: TsdocRule,
	severity: Severity,
	file: string,
	position: Position,
	message: string,
): Finding {
	return {
		column: position.column,
		file,
		line: position.line,
		message,
		rule,
		severity,
	};
}

/** exported宣言1つ分のTSDocを検査する */
export function classifyDeclaration(
	declaration: Declaration,
	file: string,
	source: string,
): Finding[] {
	const comment = declaration.comment;
	if (comment === null) {
		return [
			finding(
				"missing-doc",
				"warning",
				file,
				declaration,
				`exported ${declaration.kind} ${declaration.name} has no TSDoc comment`,
			),
		];
	}
	const parsed = parseTsdoc(comment.text);
	const findings: Finding[] = [];
	for (const issue of parsed.issues) {
		const position = positionAt(source, comment.start + issue.position);
		const syntaxError = !TAG_MESSAGE_IDS.has(issue.messageId);
		findings.push(
			finding(
				syntaxError ? "tsdoc-syntax" : "tsdoc-tag",
				syntaxError ? "error" : "warning",
				file,
				position,
				`${declaration.name}: ${issue.message}`,
			),
		);
	}
	const parameters = new Set(declaration.parameters);
	for (const name of parsed.parameters) {
		if (!parameters.has(name)) {
			findings.push(
				finding(
					"param-mismatch",
					"error",
					file,
					comment,
					`${declaration.name} has no parameter named ${name}`,
				),
			);
		}
	}
	const typeParameters = new Set(declaration.typeParameters);
	for (const name of parsed.typeParameters) {
		if (!typeParameters.has(name)) {
			findings.push(
				finding(
					"type-param-mismatch",
					"error",
					file,
					comment,
					`${declaration.name} has no type parameter named ${name}`,
				),
			);
		}
	}
	return findings;
}
