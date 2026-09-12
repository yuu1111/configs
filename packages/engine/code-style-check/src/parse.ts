import { type ParserPlugin, parse } from "@babel/parser";
import type {
	ClassMethod,
	ClassPrivateMethod,
	Expression,
	Node,
	PrivateName,
	VariableDeclarator,
} from "@babel/types";
import type { DefinitionKind } from "./rules";

/**
 * 1始まりの行と桁
 */
export interface Position {
	column: number;
	line: number;
}

/**
 * 空行で区切る対象になる定義1件の種類と名前と原文上の範囲
 */
export interface Definition extends Position {
	end: number;
	kind: DefinitionKind;
	name: string;
	start: number;
}

/**
 * 同じ並びの中で隣接する定義の組
 */
export interface DefinitionPair {
	next: Definition;
	previous: Definition;
}

interface Candidate {
	end: number;
	kind: DefinitionKind;
	name: string;
	start: number;
}

const SKIPPED_KEYS = new Set([
	"comments",
	"errors",
	"extra",
	"innerComments",
	"leadingComments",
	"loc",
	"tokens",
	"trailingComments",
]);

/**
 * 0始まりのoffsetを1始まりの行と桁へ変換する
 *
 * @param source - offsetの行と桁を数える対象のsource文字列
 * @param offset - 1始まりへ変換する0始まりの文字位置
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

function isNode(value: unknown): value is Node {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { type?: unknown }).type === "string"
	);
}

function methodName(key: Expression | PrivateName): string {
	if (key.type === "Identifier") {
		return key.name;
	}
	if (key.type === "PrivateName") {
		return `#${key.id.name}`;
	}
	if (key.type === "StringLiteral" || key.type === "NumericLiteral") {
		return String(key.value);
	}
	return "method";
}

function methodKind(node: ClassMethod | ClassPrivateMethod): DefinitionKind {
	if (node.kind === "constructor") {
		return "constructor";
	}
	if (node.kind === "get") {
		return "getter";
	}
	if (node.kind === "set") {
		return "setter";
	}
	return "method";
}

function entityName(id: Node): string {
	if (id.type === "Identifier") {
		return id.name;
	}
	if (id.type === "ThisExpression") {
		return "this";
	}
	if (id.type === "TSQualifiedName") {
		return `${entityName(id.left)}.${id.right.name}`;
	}
	return "namespace";
}

function moduleName(id: Node): string {
	return id.type === "StringLiteral" ? id.value : entityName(id);
}

function variableName(declarations: readonly VariableDeclarator[]): string {
	const names: string[] = [];
	for (const declaration of declarations) {
		if (declaration.id.type !== "Identifier") {
			return "variable";
		}
		names.push(declaration.id.name);
	}
	return names.length > 0 ? names.join(", ") : "variable";
}

function candidateOf(node: Node): Candidate | null {
	const start = node.start ?? 0;
	const end = node.end ?? start;
	switch (node.type) {
		case "FunctionDeclaration":
			return node.body === null
				? null
				: { end, kind: "function", name: node.id?.name ?? "default", start };
		case "ClassDeclaration":
			return { end, kind: "class", name: node.id?.name ?? "default", start };
		case "VariableDeclaration":
			return {
				end,
				kind: "variable",
				name: variableName(node.declarations),
				start,
			};
		case "TSTypeAliasDeclaration":
			return { end, kind: "type", name: node.id.name, start };
		case "TSInterfaceDeclaration":
			return { end, kind: "interface", name: node.id.name, start };
		case "TSEnumDeclaration":
			return { end, kind: "enum", name: node.id.name, start };
		case "TSModuleDeclaration":
			return node.body === undefined || node.body === null
				? null
				: { end, kind: "namespace", name: moduleName(node.id), start };
		case "ClassMethod":
		case "ClassPrivateMethod":
			return node.body === null
				? null
				: { end, kind: methodKind(node), name: methodName(node.key), start };
		default:
			return null;
	}
}

function elementCandidate(node: Node): Candidate | null {
	const direct = candidateOf(node);
	if (direct !== null) {
		return direct;
	}
	if (
		node.type !== "ExportNamedDeclaration" &&
		node.type !== "ExportDefaultDeclaration"
	) {
		return null;
	}
	const declaration = node.declaration;
	if (declaration === null || declaration === undefined) {
		return null;
	}
	const inner = candidateOf(declaration);
	if (inner === null) {
		return null;
	}
	return {
		end: node.end ?? inner.end,
		kind: inner.kind,
		name: inner.name,
		start: node.start ?? inner.start,
	};
}

function toDefinition(candidate: Candidate, source: string): Definition {
	return { ...positionAt(source, candidate.start), ...candidate };
}

function collectPairs(
	elements: readonly Node[],
	source: string,
	pairs: DefinitionPair[],
): void {
	let previous: Definition | null = null;
	for (const element of elements) {
		const candidate = elementCandidate(element);
		if (candidate === null) {
			previous = null;
			continue;
		}
		const current = toDefinition(candidate, source);
		if (previous !== null) {
			pairs.push({ next: current, previous });
		}
		previous = current;
	}
}

function collectBody(
	node: Node,
	source: string,
	pairs: DefinitionPair[],
): void {
	const body: unknown = "body" in node ? node.body : undefined;
	if (Array.isArray(body)) {
		collectPairs(body.filter(isNode), source, pairs);
	}
}

function childNodes(value: unknown): Node[] {
	if (Array.isArray(value)) {
		return value.filter(isNode);
	}
	return isNode(value) ? [value] : [];
}

function walk(node: Node, source: string, pairs: DefinitionPair[]): void {
	collectBody(node, source, pairs);
	for (const [key, value] of Object.entries(node)) {
		if (SKIPPED_KEYS.has(key)) {
			continue;
		}
		for (const child of childNodes(value)) {
			walk(child, source, pairs);
		}
	}
}

function parserPlugins(fileName: string): ParserPlugin[] {
	const plugins: ParserPlugin[] = ["decorators-legacy"];
	if (fileName.endsWith(".tsx")) {
		plugins.push("typescript", "jsx");
	} else if (
		fileName.endsWith(".ts") ||
		fileName.endsWith(".mts") ||
		fileName.endsWith(".cts")
	) {
		plugins.push("typescript");
	} else if (fileName.endsWith(".jsx")) {
		plugins.push("jsx");
	}
	return plugins;
}

/**
 * 同じ並びの中で隣接する定義の組を集める
 *
 * @param source - 定義を解析するsource文字列
 * @param fileName - 使用するparser pluginをfile名から決めるためのpath
 * @returns 同じ並びで隣接する定義の組
 */
export function collectAdjacentDefinitions(
	source: string,
	fileName: string,
): DefinitionPair[] {
	const ast = parse(source, {
		plugins: parserPlugins(fileName),
		sourceType: "unambiguous",
	});
	const pairs: DefinitionPair[] = [];
	walk(ast.program, source, pairs);
	return pairs;
}
