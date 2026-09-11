export const RULE_IDS = [
	"broad-suppression",
	"undocumented-directive",
	"placeholder-comment",
	"separator-comment",
] as const;

export type RuleId = (typeof RULE_IDS)[number];

export interface Finding {
	rule: RuleId;
	file: string;
	line: number;
	column: number;
	text: string;
}

const PLACEHOLDER_PATTERN = /\b(TODO|FIXME|XXX|HACK)\b/;
const SEPARATOR_PATTERN = /^[-=*_#~+./\\|]{4,}$/;
const DIRECTIVE_PATTERN = /^@ts-(?:ignore|expect-error)\b([\s\S]*)$/;

export function normalizeComment(body: string): string {
	return body
		.split("\n")
		.map((line) => line.replace(/^\s*\*+\s?/, ""))
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
}

export function classifyComment(body: string): RuleId | null {
	const text = normalizeComment(body);
	if (text === "") {
		return null;
	}
	if (
		/^(?:biome-ignore-all|@ts-nocheck)\b/.test(text) ||
		/^eslint-disable(?:-next-line|-line)?\s*$/.test(text)
	) {
		return "broad-suppression";
	}
	const directive = DIRECTIVE_PATTERN.exec(text);
	if (directive) {
		return (directive[1] ?? "").replace(/^[\s:—-]+/, "") === ""
			? "undocumented-directive"
			: null;
	}
	if (PLACEHOLDER_PATTERN.test(text)) {
		return "placeholder-comment";
	}
	if (SEPARATOR_PATTERN.test(text)) {
		return "separator-comment";
	}
	return null;
}
