import { parse } from "@babel/parser";
import type { Comment, Node } from "@babel/types";

export interface Position {
	column: number;
	line: number;
}

/** TSDocとして解釈する block comment の位置と本文 */
export interface DocComment extends Position {
	start: number;
	text: string;
}

/** 宣言に付けた抑制comment 1行分 */
export interface Suppression extends Position {
	reason: string;
	rules: string[];
}

export interface Declaration extends Position {
	comment: DocComment | null;
	kind: string;
	name: string;
	parameters: string[];
	suppressions: Suppression[];
	typeParameters: string[];
}

interface DeclaredSymbol {
	kind: string;
	name: string;
	parameters: string[];
	typeParameters: string[];
}

/** 0始まりのoffsetを1始まりの行と桁へ変換する */
export function positionAt(source: string, offset: number): Position {
	const limit = Math.min(Math.max(offset, 0), source.length);
	let line = 1;
	let lineStart = 0;
	for (let index = 0; index < limit; index += 1) {
		if (source[index] === "\n") {
			line += 1;
			lineStart = index + 1;
		}
	}
	return { column: limit - lineStart + 1, line };
}

function isDocComment(comment: Comment): boolean {
	return comment.type === "CommentBlock" && comment.value.startsWith("*");
}

function docCommentOf(node: Node, source: string): DocComment | null {
	const last = node.leadingComments?.at(-1);
	if (last === undefined || !isDocComment(last)) {
		return null;
	}
	if (
		last.start === null ||
		last.start === undefined ||
		last.end === null ||
		last.end === undefined
	) {
		return null;
	}
	return {
		...positionAt(source, last.start),
		start: last.start,
		text: source.slice(last.start, last.end),
	};
}

const DIRECTIVE = "tsdoc-check-ignore";

function parseDirective(
	line: string,
): { reason: string; rules: string[] } | null {
	const text = line
		.trim()
		.replace(/^\*+\s*/, "")
		.trim();
	if (!text.startsWith(DIRECTIVE)) {
		return null;
	}
	const body = text.slice(DIRECTIVE.length);
	const separator = body.indexOf(":");
	const ruleText = separator === -1 ? body : body.slice(0, separator);
	const reason = separator === -1 ? "" : body.slice(separator + 1).trim();
	return {
		reason,
		rules: ruleText.split(/\s+/).filter((rule) => rule.length > 0),
	};
}

/** 宣言の前にあるcommentから抑制commentを集める */
function suppressionsOf(node: Node, source: string): Suppression[] {
	const suppressions: Suppression[] = [];
	for (const comment of node.leadingComments ?? []) {
		if (comment.start === null || comment.start === undefined) {
			continue;
		}
		let offset = comment.start + 2;
		for (const line of comment.value.split("\n")) {
			const directive = parseDirective(line);
			if (directive !== null) {
				suppressions.push({ ...positionAt(source, offset), ...directive });
			}
			offset += line.length + 1;
		}
	}
	return suppressions;
}

function bindingName(node: Node | null | undefined): string | null {
	if (node === null || node === undefined) {
		return null;
	}
	switch (node.type) {
		case "AssignmentPattern":
			return bindingName(node.left);
		case "Identifier":
			return node.name;
		case "RestElement":
			return bindingName(node.argument);
		case "TSParameterProperty":
			return bindingName(node.parameter);
		default:
			return null;
	}
}

function parameterNames(params: readonly Node[] | null | undefined): string[] {
	const names: string[] = [];
	for (const parameter of params ?? []) {
		const name = bindingName(parameter);
		if (name !== null) {
			names.push(name);
		}
	}
	return names;
}

function typeParameterNames(node: Node): string[] {
	if (!("typeParameters" in node)) {
		return [];
	}
	const declaration = node.typeParameters;
	if (
		declaration === null ||
		declaration === undefined ||
		declaration.type !== "TSTypeParameterDeclaration"
	) {
		return [];
	}
	return declaration.params.map((parameter) => parameter.name.name);
}

function callableSymbol(
	kind: string,
	name: string,
	node: Node,
): DeclaredSymbol {
	const params =
		"params" in node && Array.isArray(node.params) ? node.params : [];
	return {
		kind,
		name,
		parameters: parameterNames(params),
		typeParameters: typeParameterNames(node),
	};
}

function symbolsOf(node: Node): DeclaredSymbol[] {
	switch (node.type) {
		case "ArrowFunctionExpression":
		case "FunctionExpression":
			return [callableSymbol("function", "default", node)];
		case "ClassDeclaration":
			return [
				{
					kind: "class",
					name: node.id?.name ?? "default",
					parameters: [],
					typeParameters: typeParameterNames(node),
				},
			];
		case "FunctionDeclaration":
			return [callableSymbol("function", node.id?.name ?? "default", node)];
		case "TSEnumDeclaration":
			return [
				{
					kind: "enum",
					name: node.id.name,
					parameters: [],
					typeParameters: [],
				},
			];
		case "TSInterfaceDeclaration":
			return [
				{
					kind: "interface",
					name: node.id.name,
					parameters: [],
					typeParameters: typeParameterNames(node),
				},
			];
		case "TSTypeAliasDeclaration":
			return [
				{
					kind: "type",
					name: node.id.name,
					parameters: [],
					typeParameters: typeParameterNames(node),
				},
			];
		case "VariableDeclaration": {
			const symbols: DeclaredSymbol[] = [];
			for (const declarator of node.declarations) {
				if (declarator.id.type !== "Identifier") {
					continue;
				}
				const init = declarator.init;
				if (
					init !== null &&
					init !== undefined &&
					(init.type === "ArrowFunctionExpression" ||
						init.type === "FunctionExpression")
				) {
					symbols.push(callableSymbol("function", declarator.id.name, init));
				} else {
					symbols.push({
						kind: "variable",
						name: declarator.id.name,
						parameters: [],
						typeParameters: [],
					});
				}
			}
			return symbols;
		}
		default:
			return [];
	}
}

/** top-levelのexported宣言だけを集める */
export function collectDeclarations(
	source: string,
	fileName: string,
): Declaration[] {
	const ast = fileName.endsWith(".tsx")
		? parse(source, { plugins: ["typescript", "jsx"], sourceType: "module" })
		: parse(source, { plugins: ["typescript"], sourceType: "module" });
	const declarations: Declaration[] = [];
	for (const statement of ast.program.body) {
		if (
			statement.type === "ExportAllDeclaration" ||
			!statement.type.startsWith("Export")
		) {
			continue;
		}
		const target =
			statement.type === "ExportNamedDeclaration" ||
			statement.type === "ExportDefaultDeclaration"
				? (statement.declaration as Node | null | undefined)
				: statement;
		if (target === null || target === undefined) {
			continue;
		}
		const comment = docCommentOf(statement, source);
		const position = positionAt(source, statement.start ?? 0);
		const suppressions = suppressionsOf(statement, source);
		for (const symbol of symbolsOf(target)) {
			declarations.push({ ...position, ...symbol, comment, suppressions });
		}
	}
	return declarations;
}
