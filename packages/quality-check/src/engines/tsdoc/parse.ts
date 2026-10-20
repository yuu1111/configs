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
 * 検査対象の宣言1件の種別、名前、引数と付随comment
 */
export interface Declaration extends Position {
	comment: DocComment | null;

	/**
	 * 公開surfaceに属する宣言か トップレベルのexportと別名exportがtrueになる
	 */
	exported: boolean;
	kind: string;

	/**
	 * 関数本体の中にある宣言か
	 */
	local: boolean;
	name: string;
	parameters: string[];
	returnType: string | null;
	suppressions: Suppression[];
	typeParameters: string[];
}

/**
 * fileから集めた宣言と、どの宣言にも取り込まれなかったTSDoc comment
 */
export interface CollectedSource {
	declarations: Declaration[];

	/**
	 * どの宣言の文書にもならなかったTSDoc comment
	 */
	orphans: DocComment[];
}

interface DeclaredSymbol {
	kind: string;
	name: string;
	parameters: string[];
	returnType: string | null;
	typeParameters: string[];
}

/**
 * 宣言を走査するときの位置づけ
 */
interface Context {
	/**
	 * トップレベルでexportされているか
	 */
	exported: boolean;

	/**
	 * 関数本体の中か
	 */
	local: boolean;

	/**
	 * トップレベルの文か
	 */
	topLevel: boolean;
}

/**
 * 宣言nodeから読み取るpropertyを持つ部分的な形
 */
interface NodeShape {
	arguments?: (Node | null)[];
	body?: Node | Node[] | null;
	callee?: Node | null;
	declaration?: Node | null;
	declarations?: Node[];
	elements?: (Node | null)[];
	expression?: Node | null;
	id?: Node | null;
	init?: Node | null;
	key?: Node | null;
	local?: Node | null;
	members?: Node[];
	object?: Node | null;
	parameters?: Node[];
	properties?: Node[];
	source?: Node | null;
	specifiers?: Node[];
	typeAnnotation?: Node | null;
	value?: Node | null;
}

/**
 * nodeを読み取るための部分的な形として扱う
 *
 * @param node - 読み取るnode
 * @returns 読み取るpropertyを持つ部分的な形
 */
function shape(node: Node | null | undefined): NodeShape {
	return (node ?? {}) as NodeShape;
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

/**
 * sourceにあるTSDoc commentをすべて集める
 *
 * @param comments - 解析したcommentの一覧
 * @param source - commentを切り出したsource文字列
 * @returns 位置順のTSDoc comment一覧
 */
function docCommentsOf(
	comments: readonly Comment[] | null | undefined,
	source: string,
): DocComment[] {
	const docs: DocComment[] = [];
	for (const comment of comments ?? []) {
		if (
			!isDocComment(comment) ||
			comment.start === null ||
			comment.start === undefined ||
			comment.end === null ||
			comment.end === undefined
		) {
			continue;
		}
		docs.push({
			...positionAt(source, comment.start),
			start: comment.start,
			text: source.slice(comment.start, comment.end),
		});
	}
	return docs;
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

/**
 * メンバーのkeyから表示する名前を取り出す 計算keyは対象外にする
 *
 * @param node - 名前を取り出すメンバー
 * @returns メンバーの名前 取り出せなければnull
 */
function memberName(node: Node): string | null {
	const key = shape(node).key;
	if (key === null || key === undefined) {
		return null;
	}
	switch (key.type) {
		case "Identifier":
			return key.name;
		case "NumericLiteral":
		case "StringLiteral":
			return String(key.value);
		case "PrivateName":
			return `#${key.id.name}`;
		default:
			return null;
	}
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

/**
 * 宣言nodeのidから表示する名前を取り出す
 *
 * @param node - 名前を取り出す宣言
 * @returns 宣言の名前 取り出せなければnull
 */
function declaredName(node: Node): string | null {
	const id = shape(node).id;
	if (id?.type === "Identifier") {
		return id.name;
	}
	if (id?.type === "StringLiteral") {
		return String(id.value);
	}
	return null;
}

/**
 * class と interface と type literal と object literal のメンバー1つ分の symbol を返す
 *
 * @param node - symbolを取り出すメンバー
 * @param source - 宣言を切り出したsource文字列
 * @returns メンバーが宣言するsymbol
 */
function memberSymbolsOf(node: Node, source: string): DeclaredSymbol[] {
	switch (node.type) {
		case "ClassMethod":
		case "ClassPrivateMethod":
		case "ObjectMethod":
		case "TSDeclareMethod":
		case "TSMethodSignature": {
			const name = memberName(node);
			return name === null
				? []
				: [callableSymbol("method", name, node, source)];
		}
		case "ClassProperty":
		case "ClassPrivateProperty":
		case "TSPropertySignature": {
			const name = memberName(node);
			if (name === null) {
				return [];
			}
			return [
				{
					kind: "property",
					name,
					parameters: [],
					returnType: null,
					typeParameters: typeParameterNames(node),
				},
			];
		}
		case "ObjectProperty": {
			const name = memberName(node);
			if (name === null) {
				return [];
			}
			const value = shape(node).value;
			if (
				value !== null &&
				value !== undefined &&
				(value.type === "ArrowFunctionExpression" ||
					value.type === "FunctionExpression")
			) {
				return [callableSymbol("function", name, value, source)];
			}
			return [
				{
					kind: "property",
					name,
					parameters: [],
					returnType: null,
					typeParameters: [],
				},
			];
		}
		case "TSCallSignatureDeclaration":
			return [callableSymbol("call", "call", node, source)];
		case "TSConstructSignatureDeclaration":
			return [callableSymbol("constructor", "new", node, source)];
		case "TSIndexSignature":
			return [
				{
					kind: "index",
					name: "index",
					parameters: parameterNames(shape(node).parameters),
					returnType: returnTypeText(node, source),
					typeParameters: [],
				},
			];
		case "TSEnumMember": {
			const name = declaredName(node);
			if (name === null) {
				return [];
			}
			return [
				{
					kind: "enum-member",
					name,
					parameters: [],
					returnType: null,
					typeParameters: [],
				},
			];
		}
		case "TSModuleDeclaration": {
			const name = declaredName(node) ?? "module";
			return [
				{
					kind: "namespace",
					name,
					parameters: [],
					returnType: null,
					typeParameters: [],
				},
			];
		}
		default:
			return [];
	}
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
			return memberSymbolsOf(node, source);
	}
}

/**
 * class と interface と type literal と object literal のメンバーを返す メンバーを持たない node には null を返す
 *
 * @param node - メンバーを取り出すnode
 * @returns メンバーのnode一覧 メンバーを持たなければnull
 */
function memberNodes(node: Node): Node[] | null {
	if (
		node.type === "ClassDeclaration" ||
		node.type === "ClassExpression" ||
		node.type === "TSInterfaceDeclaration"
	) {
		return bodyMembers(node);
	}
	if (node.type === "TSTypeLiteral") {
		return shape(node).members ?? [];
	}
	if (node.type === "ObjectExpression") {
		return shape(node).properties ?? [];
	}
	return null;
}

/**
 * class と interface のbodyが持つメンバーを返す
 *
 * @param node - メンバーを取り出すnode
 * @returns メンバーのnode一覧
 */
function bodyMembers(node: Node): Node[] {
	const body = shape(node).body;
	if (body === null || body === undefined || Array.isArray(body)) {
		return [];
	}
	const members = shape(body).body;
	return Array.isArray(members) ? members : [];
}

/**
 * メンバーのnodeを非公開の宣言として集める
 */
function collectMemberNodes(
	members: readonly Node[],
	context: Context,
	source: string,
	exportedNames: ReadonlySet<string>,
	out: Declaration[],
): void {
	const nested: Context = { ...context, exported: false, topLevel: false };
	for (const member of members) {
		collectDeclaration(member, nested, member, source, exportedNames, out);
	}
}

/**
 * type literalのメンバーを集める
 */
function collectTypeLiteralMembers(
	node: Node,
	context: Context,
	source: string,
	exportedNames: ReadonlySet<string>,
	out: Declaration[],
): void {
	const annotation = shape(node).typeAnnotation;
	if (annotation?.type !== "TSTypeLiteral") {
		return;
	}
	collectMemberNodes(
		shape(annotation).members ?? [],
		context,
		source,
		exportedNames,
		out,
	);
}

/**
 * 関数parameterのinline object typeが持つメンバーを集める
 */
function collectParameterTypeMembers(
	node: Node,
	context: Context,
	source: string,
	exportedNames: ReadonlySet<string>,
	out: Declaration[],
): void {
	const params =
		"params" in node && Array.isArray(node.params) ? node.params : [];
	for (const parameter of params) {
		let target = parameter as Node;
		if (target.type === "TSParameterProperty") {
			target = target.parameter;
		}
		if (target.type === "AssignmentPattern") {
			target = target.left;
		}
		if (target.type === "RestElement") {
			target = target.argument;
		}
		const annotation = shape(target).typeAnnotation;
		if (annotation?.type !== "TSTypeAnnotation") {
			continue;
		}
		const type = shape(annotation).typeAnnotation;
		if (type?.type === "TSTypeLiteral") {
			collectMemberNodes(
				shape(type).members ?? [],
				context,
				source,
				exportedNames,
				out,
			);
		}
	}
}

/**
 * namespaceの本体を非公開の宣言として集める
 */
function collectModuleBody(
	node: Node,
	context: Context,
	source: string,
	exportedNames: ReadonlySet<string>,
	out: Declaration[],
): void {
	const body = shape(node).body;
	if (body === null || body === undefined || Array.isArray(body)) {
		return;
	}
	const nested: Context = { ...context, exported: false, topLevel: false };
	if (body.type === "TSModuleBlock") {
		collectStatements(body, nested, source, exportedNames, out);
		return;
	}
	if (body.type === "TSModuleDeclaration") {
		collectDeclaration(body, nested, body, source, exportedNames, out);
	}
}

/**
 * 変数の初期化式にある関数本体を関数の中の宣言として集める
 */
function collectDeclaratorExpressions(
	node: Node,
	context: Context,
	source: string,
	exportedNames: ReadonlySet<string>,
	out: Declaration[],
): void {
	const nested: Context = { ...context, local: true, topLevel: false };
	for (const declarator of shape(node).declarations ?? []) {
		collectExpression(
			shape(declarator).init,
			nested,
			source,
			exportedNames,
			out,
		);
	}
}

/**
 * 関数本体の宣言を集める 関数でなければ何もしない
 */
function collectFunctionBody(
	node: Node,
	source: string,
	exportedNames: ReadonlySet<string>,
	out: Declaration[],
): void {
	const body = shape(node).body;
	if (
		body === null ||
		body === undefined ||
		Array.isArray(body) ||
		body.type !== "BlockStatement"
	) {
		return;
	}
	collectStatements(
		body,
		{ exported: false, local: true, topLevel: false },
		source,
		exportedNames,
		out,
	);
}

/**
 * 式が持つ関数本体と class と object literal のメンバーへ降りる
 *
 * object literal は引数や配列や wrapper の内側にも書けるため、値を包む式も辿る
 */
function collectExpression(
	node: Node | null | undefined,
	context: Context,
	source: string,
	exportedNames: ReadonlySet<string>,
	out: Declaration[],
): void {
	if (node === null || node === undefined) {
		return;
	}
	switch (node.type) {
		case "ArrowFunctionExpression":
		case "FunctionExpression":
			collectParameterTypeMembers(node, context, source, exportedNames, out);
			collectFunctionBody(node, source, exportedNames, out);
			return;
		case "ClassExpression":
		case "ObjectExpression":
			collectMembers(node, context, source, exportedNames, out);
			return;
		case "ArrayExpression":
			for (const element of shape(node).elements ?? []) {
				collectExpression(element, context, source, exportedNames, out);
			}
			return;
		case "CallExpression":
		case "NewExpression":
		case "OptionalCallExpression":
			collectExpression(
				shape(node).callee,
				context,
				source,
				exportedNames,
				out,
			);
			for (const argument of shape(node).arguments ?? []) {
				collectExpression(argument, context, source, exportedNames, out);
			}
			return;
		case "MemberExpression":
		case "OptionalMemberExpression":
			collectExpression(
				shape(node).object,
				context,
				source,
				exportedNames,
				out,
			);
			return;
		case "ParenthesizedExpression":
		case "TSAsExpression":
		case "TSInstantiationExpression":
		case "TSNonNullExpression":
		case "TSSatisfiesExpression":
		case "TSTypeAssertion":
			collectExpression(
				shape(node).expression,
				context,
				source,
				exportedNames,
				out,
			);
			return;
		default:
			return;
	}
}

/**
 * 宣言nodeが持つメンバーと本体へ降りる
 */
function collectMembers(
	node: Node,
	context: Context,
	source: string,
	exportedNames: ReadonlySet<string>,
	out: Declaration[],
): void {
	collectParameterTypeMembers(node, context, source, exportedNames, out);
	const members = memberNodes(node);
	if (members !== null) {
		collectMemberNodes(members, context, source, exportedNames, out);
		return;
	}
	if (node.type === "TSTypeAliasDeclaration") {
		collectTypeLiteralMembers(node, context, source, exportedNames, out);
		return;
	}
	if (node.type === "TSModuleDeclaration") {
		collectModuleBody(node, context, source, exportedNames, out);
		return;
	}
	if (node.type === "VariableDeclaration") {
		collectDeclaratorExpressions(node, context, source, exportedNames, out);
		return;
	}
	if (node.type === "ObjectProperty") {
		collectExpression(shape(node).value, context, source, exportedNames, out);
		return;
	}
	collectFunctionBody(node, source, exportedNames, out);
}

/**
 * file先頭のTSDocをfile-level documentationとして扱うかを返す
 *
 * 通常のfile-level TSDocは後続のcommentや宣言から空行で区切る
 * `@packageDocumentation` は標準的なfile-level markerなので空行を必須にしない
 */
function isFileLevelDoc(comment: DocComment, source: string): boolean {
	if (source.slice(0, comment.start).trim().length > 0) {
		return false;
	}
	if (/(?:^|\r?\n)[ \t]*\*[ \t]*@packageDocumentation\b/.test(comment.text)) {
		return true;
	}
	const following = source.slice(comment.start + comment.text.length);
	return /^[ \t]*\r?\n[ \t]*\r?\n/.test(following);
}

/**
 * 宣言1件をsymbolごとに書き出し その宣言が持つメンバーへ降りる
 */
function collectDeclaration(
	node: Node,
	context: Context,
	carrier: Node,
	source: string,
	exportedNames: ReadonlySet<string>,
	out: Declaration[],
): void {
	const comment = docCommentOf(carrier, source);
	const position = positionAt(source, carrier.start ?? 0);
	const suppressions = suppressionsOf(carrier, source);
	for (const symbol of symbolsOf(node, source)) {
		out.push({
			...position,
			...symbol,
			comment,
			exported:
				context.exported ||
				(context.topLevel && exportedNames.has(symbol.name)),
			local: context.local,
			suppressions,
		});
	}
	collectMembers(node, context, source, exportedNames, out);
}

/**
 * 文1件を宣言として扱い exportの形に応じて公開surfaceかどうかを決める
 */
function collectStatement(
	statement: Node,
	context: Context,
	source: string,
	exportedNames: ReadonlySet<string>,
	out: Declaration[],
): void {
	if (statement.type === "ExportAllDeclaration") {
		return;
	}
	if (statement.type === "ExportNamedDeclaration") {
		const declaration = shape(statement).declaration;
		if (declaration !== null && declaration !== undefined) {
			collectDeclaration(
				declaration,
				{ ...context, exported: true },
				statement,
				source,
				exportedNames,
				out,
			);
		}
		return;
	}
	if (statement.type === "ExportDefaultDeclaration") {
		const declaration = shape(statement).declaration;
		if (
			declaration !== null &&
			declaration !== undefined &&
			declaration.type !== "Identifier"
		) {
			collectDeclaration(
				declaration,
				{ ...context, exported: true },
				statement,
				source,
				exportedNames,
				out,
			);
		}
		return;
	}
	collectDeclaration(statement, context, statement, source, exportedNames, out);
}

/**
 * 文の並びを集める
 */
function collectStatements(
	node: Node,
	context: Context,
	source: string,
	exportedNames: ReadonlySet<string>,
	out: Declaration[],
): void {
	const statements = shape(node).body;
	if (!Array.isArray(statements)) {
		return;
	}
	for (const statement of statements) {
		collectStatement(statement, context, source, exportedNames, out);
	}
}

/**
 * 別名exportが指す宣言名を集める 再exportは対象外にする
 */
function addNamedExportNames(statement: Node, names: Set<string>): void {
	if (
		shape(statement).source !== null &&
		shape(statement).source !== undefined
	) {
		return;
	}
	for (const specifier of shape(statement).specifiers ?? []) {
		const local = shape(specifier).local;
		if (local?.type === "Identifier") {
			names.add(local.name);
		}
	}
}

/**
 * export defaultが指す宣言名を集める 式を直接exportするときは何もしない
 */
function addDefaultExportName(statement: Node, names: Set<string>): void {
	const declaration = shape(statement).declaration;
	if (declaration?.type === "Identifier") {
		names.add(declaration.name);
	}
}

/**
 * export =が指す宣言名を集める
 */
function addAssignedExportName(statement: Node, names: Set<string>): void {
	const expression = shape(statement).expression;
	if (expression?.type === "Identifier") {
		names.add(expression.name);
	}
}

/**
 * 別名exportとexport defaultとexport =が指す宣言の名前を集める
 *
 * @param program - 走査するprogramのnode
 * @returns 公開surfaceとして扱う宣言名
 */
function exportedNamesOf(program: Node): ReadonlySet<string> {
	const names = new Set<string>();
	for (const statement of (shape(program).body as Node[] | undefined) ?? []) {
		if (statement.type === "ExportNamedDeclaration") {
			addNamedExportNames(statement, names);
			continue;
		}
		if (statement.type === "ExportDefaultDeclaration") {
			addDefaultExportName(statement, names);
			continue;
		}
		if (statement.type === "TSExportAssignment") {
			addAssignedExportName(statement, names);
		}
	}
	return names;
}

/**
 * fileの宣言と、どの宣言にも付かなかったTSDocを集める 公開surfaceと関数本体の中かどうかを各宣言へ付ける
 *
 * @param source - 宣言を解析するsource文字列
 * @param fileName - tsxかどうかの判定に使うfile名
 * @returns 収集した宣言と孤児TSDoc
 */
export function collectSource(
	source: string,
	fileName: string,
): CollectedSource {
	const ast = fileName.endsWith(".tsx")
		? parse(source, { plugins: ["typescript", "jsx"], sourceType: "module" })
		: parse(source, { plugins: ["typescript"], sourceType: "module" });
	const exportedNames = exportedNamesOf(ast.program);
	const declarations: Declaration[] = [];
	const context: Context = { exported: false, local: false, topLevel: true };
	for (const statement of ast.program.body) {
		collectStatement(statement, context, source, exportedNames, declarations);
	}
	const used = new Set<number>();
	for (const declaration of declarations) {
		if (declaration.comment !== null) {
			used.add(declaration.comment.start);
		}
	}
	const docComments = docCommentsOf(ast.comments, source);
	const firstDoc = docComments[0];
	if (firstDoc !== undefined && isFileLevelDoc(firstDoc, source)) {
		used.add(firstDoc.start);
	}
	return {
		declarations,
		orphans: docComments.filter((comment) => !used.has(comment.start)),
	};
}
