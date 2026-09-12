import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 本文同士の段落境界と、区切りを残す理由を記録する
 */
export interface Boundary {
	after: string;
	before: string;
	decision: string;
	id: string;
	reason: string;
}

/**
 * Markdown上で空白へ畳まれる単一改行と、改行を残す理由を記録する
 */
export interface LineBreak {
	after: string;
	before: string;
	decision: string;
	id: string;
	kind: "list-continuation" | "prose";
	reason: string;
}

/**
 * 意味の切れ目を検討する長い原文行と、分割せず残す理由を記録する
 */
export interface LongLine {
	decision: string;
	id: string;
	kind: "list-item" | "prose";
	reason: string;
	text: string;
}

/**
 * 判断基準ごとの確認結果と、確認した記述または対象外の理由を記録する
 */
export interface Criterion {
	criterion: string;
	decision: string;
	evidence: string;
}

/**
 * 1文書分の確認候補と、確認時点の本文hash
 */
export interface DocumentReview {
	boundaries: Boundary[];
	document: string;
	documentSha256: string;
	lineBreaks: LineBreak[];
	longLines: LongLine[];
}

/**
 * 対象文書と判断基準を固定した検証記録
 */
export interface Review {
	criteria: Criterion[];
	documents: DocumentReview[];
	rules: string;
	rulesSha256: string;
	version: number;
}

/**
 * 検証記録のスキーマ版
 */
export const REVIEW_VERSION = 1;

/**
 * Markdownのフェンスを構成する記号と長さ
 */
export interface Fence {
	char: string;
	length: number;
}

/**
 * 文書内の1行が属する領域
 */
export type MarkdownRegion =
	| "body"
	| "fence"
	| "fence-close"
	| "fence-open"
	| "frontmatter";

/**
 * 文書内の1行と、その行が属する領域
 */
export interface MarkdownLine {
	blank: boolean;
	line: string;
	number: number;
	region: MarkdownRegion;
	structural: boolean;
}

/**
 * 段落境界の抽出で蓄積する本文ブロック
 */
interface BoundaryBlock {
	start: number;
	structural: boolean;
	text: string;
}

/**
 * UTF-8のBOMを除き、byte列を本文として読み取る
 */
function decode(data: Buffer): string {
	return data.toString("utf8").replace(/^\uFEFF/, "");
}

/**
 * byte列の変更を検出するためのSHA-256を返す
 */
function hash(data: Buffer): string {
	return createHash("sha256").update(data).digest("hex");
}

/**
 * 配列とnullを除くJSONオブジェクトか判定する
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * objectのfield名から、記録の識別に使う文字列を取り出す
 */
function readKey(record: object, name: string): string {
	const entry = Object.entries(record).find(([field]) => field === name);
	return entry === undefined ? "" : String(entry[1]);
}

/**
 * Markdownのフェンス開始行から、記号と長さを返す
 */
export function fenceStart(line: string): Fence | undefined {
	const run = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
	if (run === undefined) {
		return undefined;
	}
	return { char: run.slice(0, 1), length: run.length };
}

/**
 * 開いているMarkdownフェンスを閉じる行か判定する
 */
export function closesFence(line: string, fence: Fence): boolean {
	return new RegExp(`^ {0,3}${fence.char}${fence.length},}\\s*$`).test(line);
}

/**
 * frontmatterの区切り行か判定する
 */
function isFrontmatterBoundary(line: string): boolean {
	const trimmed = line.trim();
	return trimmed === "---" || trimmed === "...";
}

/**
 * 先頭の区切り線に対応するfrontmatter終了位置を返す
 */
export function frontmatterEndIndex(lines: string[]): number {
	if (lines[0]?.trim() !== "---") {
		return -1;
	}
	return lines.findIndex(
		(line, index) => index > 0 && isFrontmatterBoundary(line),
	);
}

/**
 * リスト項目の本文が始まる桁を返す
 */
export function listContentIndent(line: string): number | undefined {
	return /^( {0,3})(?:[-+*]|\d+[.)])( +)/.exec(line)?.[0].length;
}

/**
 * 見出し、リスト、表、コードなどのMarkdown構造行か判定する
 */
export function isStructuralLine(line: string): boolean {
	const stripped = line.trim();
	return (
		/^(?: {4}|\t)/.test(line) ||
		/^ {0,3}(?:#{1,6}\s|>|[-+*]\s|\d+[.)]\s|\[.+\]:|<)/.test(line) ||
		/^\s*(?:[-*_]\s*){3,}$/.test(line) ||
		/^\s*=+\s*$/.test(line) ||
		stripped.startsWith("|") ||
		(line.includes("|") && /^[\s|:-]+$/.test(line))
	);
}

/**
 * 1行の領域と、次の行へ引き継ぐフェンス状態を返す
 */
function classifyLine(
	line: string,
	index: number,
	frontmatterEnd: number,
	fence: Fence | undefined,
): { fence: Fence | undefined; region: MarkdownRegion } {
	if (frontmatterEnd > 0 && index <= frontmatterEnd) {
		return { fence, region: "frontmatter" };
	}
	if (fence !== undefined) {
		return closesFence(line, fence)
			? { fence: undefined, region: "fence-close" }
			: { fence, region: "fence" };
	}
	const opening = fenceStart(line);
	return opening === undefined
		? { fence: undefined, region: "body" }
		: { fence: opening, region: "fence-open" };
}

/**
 * 文書を領域付きの行へ分解する
 */
export function markdownLines(text: string): MarkdownLine[] {
	const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
	const frontmatterEnd = frontmatterEndIndex(lines);
	const result: MarkdownLine[] = [];
	let fence: Fence | undefined;
	for (const [index, line] of lines.entries()) {
		const classified = classifyLine(line, index, frontmatterEnd, fence);
		fence = classified.fence;
		const blank = line.trim() === "";
		result.push({
			blank,
			line,
			number: index + 1,
			region: classified.region,
			structural:
				classified.region === "body" ? !blank && isStructuralLine(line) : true,
		});
	}
	return result;
}

/**
 * フェンス内を除いた見出し行を順に返す
 */
function* markdownHeadings(
	text: string,
): Generator<{ heading: string | undefined; section: string | undefined }> {
	let fence: Fence | undefined;
	for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
		if (fence !== undefined) {
			if (closesFence(line, fence)) {
				fence = undefined;
			}
			continue;
		}
		const opening = fenceStart(line);
		if (opening !== undefined) {
			fence = opening;
			continue;
		}
		yield {
			heading: /^### (.+)$/.exec(line)?.[1],
			section: /^## (.+)$/.exec(line)?.[1],
		};
	}
}

/**
 * 判断基準の節にある基準名を抽出し、重複を拒否する
 */
function criterionNames(text: string): string[] {
	const names: string[] = [];
	let inCriteria = false;
	let foundCriteria = false;
	for (const { heading, section } of markdownHeadings(text)) {
		if (section !== undefined) {
			inCriteria = section.trim() === "判断基準";
			if (inCriteria) {
				if (foundCriteria) {
					throw new Error("判断基準の節が重複しています");
				}
				foundCriteria = true;
			}
			continue;
		}
		if (inCriteria && heading !== undefined) {
			names.push(heading.trim());
		}
	}
	if (names.length === 0) {
		throw new Error("判断基準の見出しがありません");
	}
	const duplicate = names.find((name, index) => names.indexOf(name) !== index);
	if (duplicate !== undefined) {
		throw new Error(`判断基準の見出しが重複しています: ${duplicate}`);
	}
	return names;
}

/**
 * 段落境界の抽出で蓄積した本文ブロックを確定する
 */
function pushBlock(
	blocks: BoundaryBlock[],
	current: string[],
	start: number,
	structural: boolean,
): void {
	if (current.length > 0) {
		blocks.push({ start, structural, text: current.join("\n") });
	}
}

/**
 * フェンスやfrontmatterとして読み飛ばす領域か判定する
 */
function isSkippedRegion(region: MarkdownRegion): boolean {
	return (
		region === "fence" || region === "fence-close" || region === "frontmatter"
	);
}

/**
 * 通常本文の段落境界を抽出するため、本文ブロックへ分割する
 */
function boundaryBlocks(text: string): BoundaryBlock[] {
	const blocks: BoundaryBlock[] = [];
	let current: string[] = [];
	let start = 0;
	let structural = false;
	for (const item of markdownLines(text)) {
		if (isSkippedRegion(item.region)) {
			continue;
		}
		if (item.region === "fence-open") {
			pushBlock(blocks, current, start, structural);
			current = [];
			structural = false;
			blocks.push({ start: item.number, structural: true, text: item.line });
			continue;
		}
		if (item.blank) {
			pushBlock(blocks, current, start, structural);
			current = [];
			structural = false;
			continue;
		}
		if (current.length === 0) {
			start = item.number;
		}
		current.push(item.line);
		structural = structural || item.structural;
	}
	pushBlock(blocks, current, start, structural);
	return blocks;
}

/**
 * 通常本文の段落境界を候補として抽出する
 */
export function proseBoundaries(text: string): Boundary[] {
	const blocks = boundaryBlocks(text);
	const result: Boundary[] = [];
	for (let index = 1; index < blocks.length; index += 1) {
		const left = blocks[index - 1];
		const right = blocks[index];
		if (left === undefined || right === undefined) {
			continue;
		}
		if (!left.structural && !right.structural) {
			result.push({
				after: right.text,
				before: left.text,
				decision: "",
				id: `L${left.start}-L${right.start}`,
				reason: "",
			});
		}
	}
	return result;
}

/**
 * 箇条書きの継続行として表示幅で折り返しているか判定する
 */
function isListContinuation(previousLine: string, line: string): boolean {
	const requiredIndent = listContentIndent(previousLine);
	const actualIndent = /^( +)\S/.exec(line)?.[1]?.length;
	return (
		requiredIndent !== undefined &&
		actualIndent !== undefined &&
		actualIndent >= requiredIndent &&
		listContentIndent(line) === undefined
	);
}

/**
 * 通常段落内と箇条書き継続行の単一改行を候補として抽出する
 */
export function proseLineBreaks(text: string): LineBreak[] {
	const result: LineBreak[] = [];
	let previous:
		| { line: string; number: number; structural: boolean }
		| undefined;
	for (const item of markdownLines(text)) {
		if (item.region !== "body" || item.blank) {
			previous = undefined;
			continue;
		}
		if (previous !== undefined) {
			const listContinuation = isListContinuation(previous.line, item.line);
			if ((!previous.structural && !item.structural) || listContinuation) {
				result.push({
					after: item.line,
					before: previous.line,
					decision: "",
					id: `L${previous.number}-L${item.number}`,
					kind: listContinuation ? "list-continuation" : "prose",
					reason: "",
				});
			}
		}
		previous = {
			line: item.line,
			number: item.number,
			structural: item.structural,
		};
	}
	return result;
}

/**
 * 意味の切れ目を検討する長い原文行を候補として抽出する
 */
export function proseLongLines(text: string, minimumLength = 160): LongLine[] {
	const result: LongLine[] = [];
	for (const item of markdownLines(text)) {
		if (item.region !== "body" || item.blank) {
			continue;
		}
		if (item.line.length < minimumLength) {
			continue;
		}
		const listItem = listContentIndent(item.line) !== undefined;
		if (item.structural && !listItem) {
			continue;
		}
		result.push({
			decision: "",
			id: `L${item.number}`,
			kind: listItem ? "list-item" : "prose",
			reason: "",
			text: item.line,
		});
	}
	return result;
}

/**
 * 1文書の確認候補と本文hashを記録する
 */
export function documentSnapshot(documentPath: string): DocumentReview {
	const document = resolve(documentPath);
	const raw = readFileSync(document);
	const text = decode(raw);
	return {
		boundaries: proseBoundaries(text),
		document,
		documentSha256: hash(raw),
		lineBreaks: proseLineBreaks(text),
		longLines: proseLongLines(text),
	};
}

/**
 * 対象文書と判断基準から、全項目が未確認の検証記録を生成する
 */
export function snapshot(documents: string[], rulesPath: string): Review {
	const rules = readFileSync(resolve(rulesPath));
	return {
		criteria: criterionNames(decode(rules)).map((criterion) => ({
			criterion,
			decision: "",
			evidence: "",
		})),
		documents: documents.map(documentSnapshot),
		rules: resolve(rulesPath),
		rulesSha256: hash(rules),
		version: REVIEW_VERSION,
	};
}

const GROUPS = [
	{
		decisions: ["checked", "not_applicable"],
		explanation: "evidence",
		key: "criterion",
		name: "criteria",
	},
	{ decisions: ["keep"], explanation: "reason", key: "id", name: "boundaries" },
	{ decisions: ["keep"], explanation: "reason", key: "id", name: "lineBreaks" },
	{ decisions: ["keep"], explanation: "reason", key: "id", name: "longLines" },
] as const;

/**
 * 記録側の項目が原本と同じ文脈を保っているか確認する
 */
function verifyContext(
	actual: Record<string, unknown>,
	original: object,
	explanation: string,
	label: string,
	prefix: string,
	errors: string[],
): void {
	for (const [field, value] of Object.entries(original)) {
		if (
			field !== "decision" &&
			field !== explanation &&
			actual[field] !== value
		) {
			errors.push(`${prefix}確認対象の文脈が改変されています: ${label}`);
		}
	}
}

/**
 * 1つの確認群について、欠落・並べ替え・文脈改変・未確認を検出する
 */
function verifyEntries(
	name: string,
	entries: unknown,
	originals: readonly object[],
	key: string,
	decisions: readonly string[],
	explanation: string,
	prefix: string,
	errors: string[],
): void {
	if (!Array.isArray(entries) || !entries.every(isRecord)) {
		errors.push(`${prefix}${name} の形式が不正です`);
		return;
	}
	const expectedKeys = originals.map((item) => readKey(item, key));
	if (
		entries.length !== originals.length ||
		entries.some((item, index) => item[key] !== expectedKeys[index])
	) {
		errors.push(
			`${prefix}${name} に項目の欠落・追加・並べ替えがあります。scanをやり直してください`,
		);
		return;
	}
	for (const [index, actual] of entries.entries()) {
		const original = originals[index];
		if (original === undefined) {
			continue;
		}
		const label = expectedKeys[index] ?? "";
		verifyContext(actual, original, explanation, label, prefix, errors);
		if (!(decisions as readonly unknown[]).includes(actual.decision)) {
			errors.push(`${prefix}未確認または未解決です: ${label}`);
		}
		const note = actual[explanation];
		if (typeof note !== "string" || note.trim() === "") {
			errors.push(`${prefix}${explanation} がありません: ${label}`);
		}
	}
}

/**
 * 文書一覧と対象が一致しているか確認する
 */
function verifyDocumentList(
	documents: unknown,
	expected: DocumentReview[],
	errors: string[],
): documents is Record<string, unknown>[] {
	if (!Array.isArray(documents) || !documents.every(isRecord)) {
		errors.push("documents の形式が不正です");
		return false;
	}
	if (
		documents.length !== expected.length ||
		documents.some((item, index) => item.document !== expected[index]?.document)
	) {
		errors.push("documents の対象が変更されています。scanをやり直してください");
		return false;
	}
	return true;
}

/**
 * 未確認項目・文脈改変・本文や基準の変更を検出して問題一覧を返す
 */
export function verify(
	documents: string[],
	review: unknown,
	rulesPath: string,
): string[] {
	if (!isRecord(review)) {
		return ["検証記録がJSONオブジェクトではありません"];
	}
	const expected = snapshot(documents, rulesPath);
	const errors: string[] = [];
	for (const key of ["version", "rules", "rulesSha256"] as const) {
		if (review[key] !== expected[key]) {
			errors.push(
				`${key} が変更されています。最終本文でscanをやり直してください`,
			);
		}
	}
	const [criteria, ...documentGroups] = GROUPS;
	verifyEntries(
		criteria.name,
		review[criteria.name],
		expected.criteria,
		criteria.key,
		criteria.decisions,
		criteria.explanation,
		"",
		errors,
	);
	if (!verifyDocumentList(review.documents, expected.documents, errors)) {
		return errors;
	}
	for (const [index, expectedDocument] of expected.documents.entries()) {
		const actual = review.documents[index];
		if (actual === undefined) {
			continue;
		}
		const prefix = `${expectedDocument.document}: `;
		if (actual.documentSha256 !== expectedDocument.documentSha256) {
			errors.push(
				`${prefix}documentSha256 が変更されています。最終本文でscanをやり直してください`,
			);
		}
		for (const group of documentGroups) {
			verifyEntries(
				group.name,
				actual[group.name],
				expectedDocument[group.name],
				group.key,
				group.decisions,
				group.explanation,
				prefix,
				errors,
			);
		}
	}
	return errors;
}
