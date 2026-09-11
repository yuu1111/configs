import {
	type Declaration,
	type Position,
	positionAt,
	type Suppression,
} from "./parse";
import { parseTsdoc } from "./tsdoc";

export type TsdocRule =
	| "missing-doc"
	| "param-mismatch"
	| "suppression"
	| "suppression-unused"
	| "tsdoc-syntax"
	| "tsdoc-tag"
	| "type-param-mismatch";
export type Severity = "error" | "warning";

export const KNOWN_RULE_NAMES = [
	"missing-doc",
	"param-mismatch",
	"suppression",
	"suppression-unused",
	"tsdoc-syntax",
	"tsdoc-tag",
	"type-param-mismatch",
] as const;

const KNOWN_RULES = new Set<string>(KNOWN_RULE_NAMES);

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
function checkDeclaration(
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

function partitionFindings(
	findings: Finding[],
	suppressions: Suppression[],
): { kept: Finding[]; used: Set<Suppression> } {
	const used = new Set<Suppression>();
	const kept: Finding[] = [];
	for (const finding of findings) {
		const matching = suppressions.find((suppression) =>
			suppression.rules.includes(finding.rule),
		);
		if (matching === undefined) {
			kept.push(finding);
			continue;
		}
		used.add(matching);
	}
	return { kept, used };
}

function suppressionFindings(
	suppressions: Suppression[],
	used: Set<Suppression>,
	file: string,
): Finding[] {
	const findings: Finding[] = [];
	for (const suppression of suppressions) {
		if (suppression.reason.length === 0) {
			findings.push(
				finding(
					"suppression",
					"error",
					file,
					suppression,
					"The suppression needs a reason",
				),
			);
			continue;
		}
		if (suppression.rules.length === 0) {
			findings.push(
				finding(
					"suppression",
					"error",
					file,
					suppression,
					"The suppression needs at least one rule",
				),
			);
			continue;
		}
		const unknown = suppression.rules.filter((rule) => !KNOWN_RULES.has(rule));
		if (unknown.length > 0) {
			findings.push(
				finding(
					"suppression",
					"error",
					file,
					suppression,
					`Unknown rule in the suppression: ${unknown.join(", ")}`,
				),
			);
			continue;
		}
		if (!used.has(suppression)) {
			findings.push(
				finding(
					"suppression-unused",
					"warning",
					file,
					suppression,
					`The suppression of ${suppression.rules.join(", ")} is not needed`,
				),
			);
		}
	}
	return findings;
}

/** 指定したruleの指摘をerrorへ引き上げる */
export function promoteFindings(
	findings: Finding[],
	rules: string[],
): Finding[] {
	return findings.map((finding) =>
		rules.includes(finding.rule) ? { ...finding, severity: "error" } : finding,
	);
}

/** 宣言の指摘へ抑制commentを適用する */
export function classifyDeclaration(
	declaration: Declaration,
	file: string,
	source: string,
): Finding[] {
	const findings = checkDeclaration(declaration, file, source);
	if (declaration.suppressions.length === 0) {
		return findings;
	}
	const { kept, used } = partitionFindings(findings, declaration.suppressions);
	return [
		...kept,
		...suppressionFindings(declaration.suppressions, used, file),
	];
}
