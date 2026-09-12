import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { type Finding, fixSource, lintSource } from "./rules";

const DOCUMENT_EXTENSIONS = new Set([".markdown", ".md"]);
const IGNORED_DIRECTORIES = new Set([
	"build",
	"coverage",
	"dist",
	"node_modules",
	"out",
	"vendor",
]);

/**
 * 区切り文字を統一し先頭の./と末尾の/を除いたpathを返す
 */
export function normalizePath(path: string): string {
	return path.split("\\").join("/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function isIgnored(path: string, ignores: string[]): boolean {
	return ignores.some(
		(ignore) => path === ignore || path.startsWith(`${ignore}/`),
	);
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
		if (entry.isFile() && DOCUMENT_EXTENSIONS.has(extname(entry.name))) {
			files.add(path);
		}
	}
}

/**
 * 対象pathを走査して検査対象のMarkdown一覧を集める
 */
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
				DOCUMENT_EXTENSIONS.has(extname(absolute)) &&
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

/**
 * fileを読み込んで違反を検出する
 */
export function lintFile(file: string, cwd = process.cwd()): Finding[] {
	return lintSource(
		readFileSync(file, "utf8"),
		normalizePath(relative(cwd, file)),
	);
}

/**
 * 複数fileの違反をまとめて位置順に並べる
 */
export function lintFiles(files: string[], cwd = process.cwd()): Finding[] {
	const findings: Finding[] = [];
	for (const file of files) {
		findings.push(...lintFile(file, cwd));
	}
	return findings.sort(compareFindings);
}

/**
 * fileを整形し、writeした場合だけtrueを返す
 */
export function fixFile(file: string): boolean {
	const source = readFileSync(file, "utf8");
	const fixed = fixSource(source);
	if (fixed === source) {
		return false;
	}
	writeFileSync(file, fixed, "utf8");
	return true;
}

/**
 * 複数fileを整形し、writeしたfile一覧を返す
 */
export function fixFiles(files: string[]): string[] {
	return files.filter((file) => fixFile(file));
}
