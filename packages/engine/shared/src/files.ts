import { readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

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
 *
 * @param path - 区切り文字を統一する対象のpath
 * @returns 区切り文字を/へ統一し先頭の./と末尾の/を除いたpath
 */
export function normalizePath(path: string): string {
	return path.split("\\").join("/").replace(/^\.\//, "").replace(/\/+$/, "");
}

/**
 * file収集の対象と除外の条件
 */
export interface CollectFilesOptions {
	/**
	 * 収集する拡張子
	 */
	extensions: ReadonlySet<string>;

	/**
	 * 相対pathを解決する基準
	 */
	cwd?: string;

	/**
	 * 検査から外すpath
	 */
	ignores?: string[];
}

function isIgnored(path: string, ignores: string[]): boolean {
	return ignores.some(
		(ignore) => path === ignore || path.startsWith(`${ignore}/`),
	);
}

function walk(
	directory: string,
	extensions: ReadonlySet<string>,
	files: Set<string>,
): void {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (entry.name.startsWith(".")) {
			continue;
		}
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			if (!IGNORED_DIRECTORIES.has(entry.name)) {
				walk(path, extensions, files);
			}
			continue;
		}
		if (entry.isFile() && extensions.has(extname(entry.name))) {
			files.add(path);
		}
	}
}

/**
 * 対象pathを走査して拡張子に合うfile一覧を集める
 *
 * @param targets - fileまたはディレクトリのpath一覧
 * @param options - 収集する拡張子と除外するpathの条件
 * @returns 拡張子に合い除外に該当しないfileの絶対path一覧
 */
export function collectFiles(
	targets: string[],
	options: CollectFilesOptions,
): string[] {
	const cwd = options.cwd ?? process.cwd();
	const ignores = options.ignores ?? [];
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
				options.extensions.has(extname(absolute)) &&
				!isIgnored(normalizePath(target), ignores)
			) {
				files.add(absolute);
			}
			continue;
		}
		walk(absolute, options.extensions, files);
	}
	return [...files]
		.filter((file) => !isIgnored(normalizePath(relative(cwd, file)), ignores))
		.sort();
}
