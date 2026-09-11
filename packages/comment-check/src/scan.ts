import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { extractComments } from "./comments";
import { classifyComment, type Finding, normalizeComment } from "./rules";

const SUPPORTED_EXTENSIONS = new Set([
	".cjs",
	".cts",
	".js",
	".jsx",
	".mjs",
	".mts",
	".ts",
	".tsx",
]);
const IGNORED_DIRECTORIES = new Set([
	"build",
	"coverage",
	"dist",
	"node_modules",
	"out",
	"vendor",
]);

/** 区切り文字を統一し先頭の./と末尾の/を除いたpathを返す */
export function normalizePath(path: string): string {
	return path.split("\\").join("/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function isIgnored(path: string, ignores: string[]): boolean {
	return ignores.some(
		(ignore) => path === ignore || path.startsWith(`${ignore}/`),
	);
}

function positionAt(
	source: string,
	offset: number,
): { line: number; column: number } {
	let line = 1;
	let lineStart = 0;
	for (let index = 0; index < offset; index += 1) {
		if (source[index] === "\n") {
			line += 1;
			lineStart = index + 1;
		}
	}
	return { line, column: offset - lineStart + 1 };
}

function compareFindings(left: Finding, right: Finding): number {
	if (left.file !== right.file) {
		return left.file < right.file ? -1 : 1;
	}
	if (left.line !== right.line) {
		return left.line - right.line;
	}
	return left.column - right.column;
}

function walk(directory: string, files: Set<string>): void {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (entry.name.startsWith(".")) {
			continue;
		}
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			if (!IGNORED_DIRECTORIES.has(entry.name)) {
				walk(path, files);
			}
			continue;
		}
		if (entry.isFile() && SUPPORTED_EXTENSIONS.has(extname(entry.name))) {
			files.add(path);
		}
	}
}

/** 対象pathを走査して検査対象のfile一覧を集める */
export function collectFiles(
	targets: string[],
	cwd = process.cwd(),
	ignores: string[] = [],
): string[] {
	const files = new Set<string>();
	for (const target of targets) {
		const absolute = resolve(cwd, target);
		let stats: ReturnType<typeof statSync>;
		try {
			stats = statSync(absolute);
		} catch {
			continue;
		}
		if (stats.isFile()) {
			if (
				SUPPORTED_EXTENSIONS.has(extname(absolute)) &&
				!isIgnored(normalizePath(target), ignores)
			) {
				files.add(absolute);
			}
			continue;
		}
		walk(absolute, files);
	}
	return [...files]
		.filter((file) => !isIgnored(normalizePath(relative(cwd, file)), ignores))
		.sort();
}

/** source文字列を走査してcomment違反を検出する */
export function scanSource(source: string, file: string): Finding[] {
	const findings: Finding[] = [];
	for (const comment of extractComments(source)) {
		const rule = classifyComment(comment.text);
		if (rule === null) {
			continue;
		}
		const position = positionAt(source, comment.start);
		findings.push({
			column: position.column,
			file,
			line: position.line,
			rule,
			text: normalizeComment(comment.text),
		});
	}
	return findings;
}

/** fileを読み込んでcomment違反を検出する */
export function scanFile(file: string, cwd = process.cwd()): Finding[] {
	return scanSource(
		readFileSync(file, "utf8"),
		normalizePath(relative(cwd, file)),
	);
}

/** 複数fileの違反をまとめて位置順に並べる */
export function scanFiles(files: string[], cwd = process.cwd()): Finding[] {
	const findings: Finding[] = [];
	for (const file of files) {
		findings.push(...scanFile(file, cwd));
	}
	return findings.sort(compareFindings);
}
