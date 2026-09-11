import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { collectDeclarations } from "./parse";
import { classifyDeclaration, type Finding } from "./rules";

const EXTENSIONS = new Set([".cts", ".mts", ".ts", ".tsx"]);
const IGNORED_DIRECTORIES = new Set([
	"build",
	"coverage",
	"dist",
	"node_modules",
	"out",
	"vendor",
]);

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
		if (entry.isFile() && EXTENSIONS.has(extname(entry.name))) {
			files.add(path);
		}
	}
}

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
				EXTENSIONS.has(extname(absolute)) &&
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

export function scanSource(source: string, file: string): Finding[] {
	try {
		return collectDeclarations(source, file).flatMap((declaration) =>
			classifyDeclaration(declaration, file, source),
		);
	} catch {
		// 構文エラーはtscとBiomeが担当するため、解析できないfileは対象外にする
		return [];
	}
}

export function scanFile(file: string, cwd = process.cwd()): Finding[] {
	return scanSource(
		readFileSync(file, "utf8"),
		normalizePath(relative(cwd, file)),
	);
}

export function scanFiles(files: string[], cwd = process.cwd()): Finding[] {
	const findings: Finding[] = [];
	for (const file of files) {
		findings.push(...scanFile(file, cwd));
	}
	return findings.sort(compareFindings);
}
