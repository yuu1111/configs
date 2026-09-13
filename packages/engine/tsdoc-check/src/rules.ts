import type { Located, Severity } from "@yuu1111/shared/findings";
import {
	type Declaration,
	type DocComment,
	type Position,
	positionAt,
	type Suppression,
} from "./parse";
import {
	KNOWN_RULE_NAMES,
	OPT_IN_RULE_IDS,
	type OptInRuleId,
	type TsdocRule,
} from "./rule-ids";
import { parseTsdoc, type TsdocResult } from "./tsdoc";

export type { OptInRuleId };
export { KNOWN_RULE_NAMES };

const KNOWN_RULES = new Set<string>(KNOWN_RULE_NAMES);

/**
 * --enableの値を検証して重複を除く 未知のrule名は設定errorにする
 *
 * @param values - --enableで渡されたrule名の一覧
 * @returns 検証済みで重複を除いたopt-in ruleの識別子一覧
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
 * TSDocに定義がないtagは構文errorではなく報告に留める
 */
const TAG_MESSAGE_IDS = new Set(["tsdoc-undefined-tag"]);

/**
 * 検出したTSDoc違反1件の内容と位置
 */
export interface Finding extends Located {
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

const VOID_RETURN_TYPES = new Set(["never", "undefined", "void"]);
const PROMISE_ANNOTATION = /^(?:Promise|PromiseLike)<([\s\S]*)>$/;

/**
 * 戻り値型の注釈が値を返すか判定する Promiseは中身で判定する
 *
 * @param annotation - 判定する戻り値型の注釈文字列
 * @returns 値または値を返すPromiseならtrue
 */
export function returnsValue(annotation: string): boolean {
	const text = annotation.trim();
	const unwrapped = (PROMISE_ANNOTATION.exec(text)?.[1] ?? text).trim();
	return unwrapped
		.split("|")
		.some((part) => !VOID_RETURN_TYPES.has(part.trim()));
}

/**
 * 宣言にある引数と型引数のうちtagが無いものを報告する
 */
function untaggedFindings(
	declaration: Declaration,
	file: string,
	comment: Position,
	parsed: TsdocResult,
): Finding[] {
	const findings: Finding[] = [];
	const parameters = new Set(parsed.parameters);
	for (const name of declaration.parameters) {
		if (!parameters.has(name)) {
			findings.push(
				finding(
					"param-untagged",
					"warning",
					file,
					comment,
					`${declaration.name} has no @param tag for the parameter ${name}`,
				),
			);
		}
	}
	const typeParameters = new Set(parsed.typeParameters);
	for (const name of declaration.typeParameters) {
		if (!typeParameters.has(name)) {
			findings.push(
				finding(
					"type-param-untagged",
					"warning",
					file,
					comment,
					`${declaration.name} has no @typeParam tag for the type parameter ${name}`,
				),
			);
		}
	}
	return findings;
}

/**
 * @param tagの並びが宣言順と違うときだけ報告する
 */
function paramOrderFinding(
	declaration: Declaration,
	file: string,
	comment: Position,
	parsed: TsdocResult,
): Finding | null {
	const declared = new Set(declaration.parameters);
	const tagged = new Set(parsed.parameters);
	const documented = declaration.parameters.filter((name) => tagged.has(name));
	const order = parsed.parameters.filter((name) => declared.has(name));
	if (documented.length < 2 || documented.join("\n") === order.join("\n")) {
		return null;
	}
	return finding(
		"param-order",
		"warning",
		file,
		comment,
		`${declaration.name} lists its @param tags out of the declaration order`,
	);
}

/**
 * @deprecatedの代替先が@seeにも{@link}にも無いときだけ報告する
 */
function deprecatedFinding(
	declaration: Declaration,
	file: string,
	comment: DocComment,
	source: string,
	parsed: TsdocResult,
): Finding | null {
	if (!parsed.hasDeprecated || parsed.hasSee) {
		return null;
	}
	const raw = source.slice(comment.start, comment.start + comment.text.length);
	if (raw.includes("{@link")) {
		return null;
	}
	return finding(
		"deprecated-without-guidance",
		"warning",
		file,
		comment,
		`${declaration.name} is deprecated without pointing to a replacement`,
	);
}

/**
 * 値を返す関数に@returnsが無いときだけ報告する
 */
function missingReturnsFinding(
	declaration: Declaration,
	file: string,
	comment: Position,
	parsed: TsdocResult,
): Finding | null {
	if (
		parsed.hasReturns ||
		declaration.returnType === null ||
		!returnsValue(declaration.returnType)
	) {
		return null;
	}
	return finding(
		"missing-returns",
		"warning",
		file,
		comment,
		`${declaration.name} returns a value but has no @returns tag`,
	);
}

/**
 * 引数と戻り値の契約を検査する opt-inのruleはenabledにあるときだけ実行する
 */
function contractFindings(
	declaration: Declaration,
	file: string,
	comment: DocComment,
	source: string,
	parsed: TsdocResult,
	enabled: readonly OptInRuleId[],
): Finding[] {
	const findings = untaggedFindings(declaration, file, comment, parsed);
	if (enabled.includes("deprecated-without-guidance")) {
		const deprecated = deprecatedFinding(
			declaration,
			file,
			comment,
			source,
			parsed,
		);
		if (deprecated !== null) {
			findings.push(deprecated);
		}
	}
	if (enabled.includes("param-order")) {
		const order = paramOrderFinding(declaration, file, comment, parsed);
		if (order !== null) {
			findings.push(order);
		}
	}
	if (enabled.includes("missing-returns")) {
		const missing = missingReturnsFinding(declaration, file, comment, parsed);
		if (missing !== null) {
			findings.push(missing);
		}
	}
	return findings;
}

/**
 * exported宣言1つ分のTSDocを検査する
 */
function checkDeclaration(
	declaration: Declaration,
	file: string,
	source: string,
	enabled: readonly OptInRuleId[],
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
	if (!comment.text.includes("\n")) {
		findings.push(
			finding(
				"single-line-doc",
				"warning",
				file,
				comment,
				`${declaration.name} has a single-line TSDoc comment`,
			),
		);
	}
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
	findings.push(
		...contractFindings(declaration, file, comment, source, parsed, enabled),
	);
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

/**
 * 指定したruleの指摘をerrorへ引き上げる
 *
 * @param findings - severityを引き上げる対象の指摘一覧
 * @param rules - errorへ引き上げるrule名の一覧
 * @returns severityを引き上げた指摘一覧
 */
export function promoteFindings(
	findings: Finding[],
	rules: string[],
): Finding[] {
	return findings.map((finding) =>
		rules.includes(finding.rule) ? { ...finding, severity: "error" } : finding,
	);
}

/**
 * 宣言の指摘へ抑制commentを適用する
 *
 * @param declaration - 検査するexported宣言
 * @param file - 指摘に載せるfileのpath
 * @param source - 宣言を切り出したsource文字列
 * @param enabled - 実行するopt-in ruleの識別子一覧
 * @returns 抑制を適用した後の指摘一覧
 */
export function classifyDeclaration(
	declaration: Declaration,
	file: string,
	source: string,
	enabled: readonly OptInRuleId[] = [],
): Finding[] {
	const findings = checkDeclaration(declaration, file, source, enabled);
	if (declaration.suppressions.length === 0) {
		return findings;
	}
	const { kept, used } = partitionFindings(findings, declaration.suppressions);
	return [
		...kept,
		...suppressionFindings(declaration.suppressions, used, file),
	];
}
