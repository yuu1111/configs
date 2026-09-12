import { type ParserPlugin, parse } from "@babel/parser";
import type { Expression, Node, PrivateName } from "@babel/types";

/**
 * 1始まりの行と桁
 */
export interface Position {
	column: number;
	line: number;
}

/**
 * 空行で区切る対象になる関数定義1件の名前と原文上の範囲
 */
export interface Definition extends Position {
	end: number;
	name: string;
	start: number;
}

/**
 * 同じ並びの中で隣接する関数定義の組
 */
export interface DefinitionPair {
	next: Definition;
	previous: Definition;
}

interface Candidate {
	end: number;
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

function candidateOf(node: Node): Candidate | null {
	const start = node.start ?? 0;
	const end = node.end ?? start;
	if (node.type === "FunctionDeclaration") {
		if (node.body === null) {
			return null;
		}
		return { end, name: node.id?.name ?? "default", start };
	}
	if (node.type === "ClassMethod" || node.type === "ClassPrivateMethod") {
		if (node.body === null) {
			return null;
		}
		const name =
			node.kind === "constructor" ? "constructor" : methodName(node.key);
		return { end, name, start };
	}
	return null;
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
 * 同じ並びの中で隣接する関数定義の組を集める
 *
 * @param source - 関数定義を解析するsource文字列
 * @param fileName - 使用するparser pluginをfile名から決めるためのpath
 * @returns 同じ並びで隣接する関数定義の組
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
