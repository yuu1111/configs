import { parse } from "@babel/parser";
import type { Comment, Node } from "@babel/types";

/**
 * 1始まりの行と桁
 */
export interface Position {
	column: number;
	line: number;
}

/**
 * TSDocとして解釈する block comment の位置と本文
 */
export interface DocComment extends Position {
	start: number;
	text: string;
}

/**
 * 宣言に付けた抑制comment 1行分
 */
export interface Suppression extends Position {
	reason: string;
	rules: string[];
}

/**
 * 検査対象のexported宣言1件の種別、名前、引数と付随comment
 */
export interface Declaration extends Position {
	comment: DocComment | null;
	kind: string;
	name: string;
	parameters: string[];
	returnType: string | null;
	suppressions: Suppression[];
	typeParameters: string[];
}

interface DeclaredSymbol {
	kind: string;
	name: string;
	parameters: string[];
	returnType: string | null;
	typeParameters: string[];
}

/**
 * 0始まりのoffsetを1始まりの行と桁へ変換する
 *
 * @param source - offsetを数える対象のsource文字列
 * @param offset - 行と桁へ変換する0始まりの文字位置
 * @returns 1始まりの行と桁
 */
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

/**
 * 宣言の前にあるcommentから抑制commentを集める
 */
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
		if (name !== null && name !== "this") {
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

/**
 * 宣言の戻り値型をsourceから切り出す 注釈が無ければnullを返す
 */
function returnTypeText(node: Node, source: string): string | null {
	const annotation = (node as { returnType?: { typeAnnotation?: Node } | null })
		.returnType;
	const inner = annotation?.typeAnnotation;
	if (
		inner === null ||
		inner === undefined ||
		inner.start === null ||
		inner.start === undefined ||
		inner.end === null ||
		inner.end === undefined
	) {
		return null;
	}
	return source.slice(inner.start, inner.end);
}

function callableSymbol(
	kind: string,
	name: string,
	node: Node,
	source: string,
): DeclaredSymbol {
	const params =
		"params" in node && Array.isArray(node.params) ? node.params : [];
	return {
		kind,
		name,
		parameters: parameterNames(params),
		returnType: returnTypeText(node, source),
		typeParameters: typeParameterNames(node),
	};
}

function symbolsOf(node: Node, source: string): DeclaredSymbol[] {
	switch (node.type) {
		case "ArrowFunctionExpression":
		case "FunctionExpression":
			return [callableSymbol("function", "default", node, source)];
		case "ClassDeclaration":
			return [
				{
					kind: "class",
					name: node.id?.name ?? "default",
					parameters: [],
					returnType: null,
					typeParameters: typeParameterNames(node),
				},
			];
		case "FunctionDeclaration":
			return [
				callableSymbol("function", node.id?.name ?? "default", node, source),
			];
		case "TSEnumDeclaration":
			return [
				{
					kind: "enum",
					name: node.id.name,
					parameters: [],
					returnType: null,
					typeParameters: [],
				},
			];
		case "TSInterfaceDeclaration":
			return [
				{
					kind: "interface",
					name: node.id.name,
					parameters: [],
					returnType: null,
					typeParameters: typeParameterNames(node),
				},
			];
		case "TSTypeAliasDeclaration":
			return [
				{
					kind: "type",
					name: node.id.name,
					parameters: [],
					returnType: null,
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
					symbols.push(
						callableSymbol("function", declarator.id.name, init, source),
					);
				} else {
					symbols.push({
						kind: "variable",
						name: declarator.id.name,
						parameters: [],
						returnType: null,
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

/**
 * top-levelのexported宣言だけを集める
 *
 * @param source - 宣言を解析するsource文字列
 * @param fileName - tsxかどうかの判定に使うfile名
 * @returns 収集したexported宣言
 */
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
		for (const symbol of symbolsOf(target, source)) {
			declarations.push({ ...position, ...symbol, comment, suppressions });
		}
	}
	return declarations;
}
