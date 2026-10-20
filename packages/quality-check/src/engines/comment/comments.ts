/**
 * 抽出するcommentの種別
 */
export type CommentKind = "line" | "block";

/**
 * 抽出したcomment1件の種別と原文上の位置
 */
export interface CommentPiece {
	kind: CommentKind;
	text: string;
	start: number;
	end: number;
}

type Mode = "code" | "template" | "expression";

interface ScanState {
	braces: number[];
	comments: CommentPiece[];
	index: number;
	modes: Mode[];
}

const REGEX_PRECEDING_CHARACTERS = new Set("(,=:[!&|?{};".split(""));
const REGEX_PRECEDING_KEYWORDS = new Set([
	"await",
	"case",
	"delete",
	"do",
	"else",
	"in",
	"instanceof",
	"new",
	"of",
	"return",
	"throw",
	"typeof",
	"void",
	"yield",
]);

function isIdentifierCharacter(character: string): boolean {
	return /[A-Za-z0-9_$]/.test(character);
}

function skipString(source: string, start: number, quote: string): number {
	let index = start + 1;
	while (index < source.length) {
		const character = source[index] ?? "";
		if (character === "\\") {
			index += 2;
			continue;
		}
		if (character === quote) {
			return index + 1;
		}
		if (character === "\n") {
			return index;
		}
		index += 1;
	}
	return index;
}

function isRegexStart(source: string, index: number): boolean {
	let previous = index - 1;
	while (previous >= 0 && /\s/.test(source[previous] ?? "")) {
		previous -= 1;
	}
	if (previous < 0) {
		return true;
	}
	const character = source[previous] ?? "";
	if (REGEX_PRECEDING_CHARACTERS.has(character)) {
		return true;
	}
	if (!isIdentifierCharacter(character)) {
		return false;
	}
	let wordStart = previous;
	while (wordStart >= 0 && isIdentifierCharacter(source[wordStart] ?? "")) {
		wordStart -= 1;
	}
	return REGEX_PRECEDING_KEYWORDS.has(
		source.slice(wordStart + 1, previous + 1),
	);
}

function skipRegex(source: string, start: number): number {
	let index = start + 1;
	let inClass = false;
	while (index < source.length) {
		const character = source[index] ?? "";
		if (character === "\\") {
			index += 2;
			continue;
		}
		if (character === "\n") {
			return start;
		}
		if (inClass) {
			inClass = character !== "]";
			index += 1;
			continue;
		}
		if (character === "[") {
			inClass = true;
			index += 1;
			continue;
		}
		if (character === "/") {
			return index + 1;
		}
		index += 1;
	}
	return start;
}

function currentMode(state: ScanState): Mode {
	return state.modes[state.modes.length - 1] ?? "code";
}

function stepComment(state: ScanState, source: string): boolean {
	const character = source[state.index] ?? "";
	const next = source[state.index + 1] ?? "";
	if (character !== "/" || (next !== "/" && next !== "*")) {
		return false;
	}
	if (next === "/") {
		const newline = source.indexOf("\n", state.index);
		const stop = newline === -1 ? source.length : newline;
		state.comments.push({
			end: stop,
			kind: "line",
			start: state.index,
			text: source.slice(state.index + 2, stop),
		});
		state.index = stop;
		return true;
	}
	const close = source.indexOf("*/", state.index + 2);
	const stop = close === -1 ? source.length : close + 2;
	state.comments.push({
		end: stop,
		kind: "block",
		start: state.index,
		text: source.slice(state.index + 2, Math.max(state.index + 2, stop - 2)),
	});
	state.index = stop;
	return true;
}

function stepString(state: ScanState, source: string): boolean {
	const character = source[state.index] ?? "";
	if (character !== "'" && character !== '"') {
		return false;
	}
	state.index = skipString(source, state.index, character);
	return true;
}

function stepTemplateStart(state: ScanState, source: string): boolean {
	if (source[state.index] !== "`") {
		return false;
	}
	state.modes.push("template");
	state.index += 1;
	return true;
}

function stepRegex(state: ScanState, source: string): boolean {
	if (source[state.index] !== "/" || !isRegexStart(source, state.index)) {
		return false;
	}
	const stop = skipRegex(source, state.index);
	if (stop <= state.index) {
		return false;
	}
	state.index = stop;
	return true;
}

function stepTemplate(state: ScanState, source: string): void {
	const character = source[state.index] ?? "";
	if (character === "\\") {
		state.index += 2;
		return;
	}
	if (character === "`") {
		state.modes.pop();
		state.index += 1;
		return;
	}
	if (character === "$" && source[state.index + 1] === "{") {
		state.modes.push("expression");
		state.braces.push(1);
		state.index += 2;
		return;
	}
	state.index += 1;
}

function stepExpression(state: ScanState, source: string): void {
	const character = source[state.index] ?? "";
	const depth = state.braces[state.braces.length - 1] ?? 0;
	if (character === "{") {
		state.braces[state.braces.length - 1] = depth + 1;
	} else if (character === "}") {
		state.braces[state.braces.length - 1] = depth - 1;
		if (depth - 1 === 0) {
			state.modes.pop();
			state.braces.pop();
		}
	}
	state.index += 1;
}

function step(state: ScanState, source: string): void {
	if (currentMode(state) === "template") {
		stepTemplate(state, source);
		return;
	}
	if (
		stepComment(state, source) ||
		stepString(state, source) ||
		stepTemplateStart(state, source) ||
		stepRegex(state, source)
	) {
		return;
	}
	stepExpression(state, source);
}

/**
 * 文字列や正規表現リテラルを除外してsourceからcommentを抽出する
 *
 * @param source - commentを抽出するsource文字列
 * @returns 抽出したcommentの一覧
 */
export function extractComments(source: string): CommentPiece[] {
	const shebang = source.startsWith("#!") ? source.indexOf("\n") : 0;
	const state: ScanState = {
		braces: [],
		comments: [],
		index: Math.max(0, shebang),
		modes: ["code"],
	};
	while (state.index < source.length) {
		step(state, source);
	}
	return state.comments;
}
