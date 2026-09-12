import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { collectFiles, normalizePath } from "../src/files";

const EXTENSIONS = new Set([".md", ".ts"]);

function withTemporaryTree<T>(
	files: Record<string, string>,
	callback: (directory: string) => T,
): T {
	const directory = mkdtempSync(join(tmpdir(), "shared-files-"));
	try {
		for (const [name, text] of Object.entries(files)) {
			const path = join(directory, name);
			mkdirSync(join(path, ".."), { recursive: true });
			writeFileSync(path, text, "utf8");
		}
		return callback(directory);
	} finally {
		rmSync(directory, { force: true, recursive: true });
	}
}

describe("normalizePath", () => {
	test("unifies separators and drops the leading ./ and trailing slash", () => {
		expect(normalizePath(".\\src\\a.ts/")).toBe("src/a.ts");
	});
});

describe("file collection", () => {
	test("keeps only the extensions the engine asks for", () => {
		withTemporaryTree(
			{ "a.md": "x", "b.ts": "x", "c.json": "x", "sub/d.md": "x" },
			(directory) => {
				const files = collectFiles([directory], {
					cwd: directory,
					extensions: EXTENSIONS,
				}).map((file) => relative(directory, file).split("\\").join("/"));
				expect(files).toEqual(["a.md", "b.ts", "sub/d.md"]);
			},
		);
	});

	test("skips ignored paths and the ignored directories", () => {
		withTemporaryTree(
			{ "a.md": "x", "sub/d.md": "x", "node_modules/e.md": "x" },
			(directory) => {
				const files = collectFiles([directory], {
					cwd: directory,
					extensions: EXTENSIONS,
					ignores: ["sub"],
				}).map((file) => relative(directory, file).split("\\").join("/"));
				expect(files).toEqual(["a.md"]);
			},
		);
	});
});
