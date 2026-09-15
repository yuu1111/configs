import { expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { collectFiles } from "@yuu1111/shared/files";
import { DOCUMENT_EXTENSIONS, fixFiles, lintFiles } from "../src/scan";

/**
 * 一時ディレクトリへfile一式を作り、後片付けする
 */
function withTemporaryTree<T>(
	files: Record<string, string>,
	callback: (directory: string) => T,
): T {
	const directory = mkdtempSync(join(tmpdir(), "document-style-scan-"));
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

test("対象ディレクトリからMarkdownだけを集める", () => {
	withTemporaryTree(
		{
			"a.md": "本文\n",
			"b.markdown": "本文\n",
			"c.txt": "本文\n",
			"sub/d.md": "本文\n",
			"node_modules/e.md": "本文\n",
			".hidden/f.md": "本文\n",
		},
		(directory) => {
			const files = collectFiles([directory], {
				cwd: directory,
				extensions: DOCUMENT_EXTENSIONS,
			}).map((file) => relative(directory, file).split("\\").join("/"));

			expect(files).toEqual(["a.md", "b.markdown", "sub/d.md"]);
		},
	);
});

test("否定globに一致するpathを検査から外す", () => {
	withTemporaryTree({ "a.md": "本文\n", "sub/d.md": "本文\n" }, (directory) => {
		const files = collectFiles([directory], {
			cwd: directory,
			extensions: DOCUMENT_EXTENSIONS,
			includes: ["**", "!sub/**"],
		}).map((file) => relative(directory, file).split("\\").join("/"));

		expect(files).toEqual(["a.md"]);
	});
});

test("違反をfile順と位置順に並べる", () => {
	withTemporaryTree(
		{
			"a.md": "本文です  \n",
			"b.md": "一行目  \n二行目  \n",
		},
		(directory) => {
			const findings = lintFiles(
				collectFiles([directory], {
					cwd: directory,
					extensions: DOCUMENT_EXTENSIONS,
				}),
				directory,
			);

			expect(findings.map((finding) => [finding.file, finding.line])).toEqual([
				["a.md", 1],
				["b.md", 1],
				["b.md", 2],
			]);
		},
	);
});

test("変更のあったfileだけを整形して返す", () => {
	withTemporaryTree(
		{ "dirty.md": "本文です  \n", "clean.md": "本文です\n" },
		(directory) => {
			const dirty = join(directory, "dirty.md");
			const clean = join(directory, "clean.md");

			expect(fixFiles([clean, dirty])).toEqual([dirty]);
			expect(readFileSync(dirty, "utf8")).toBe("本文です\n");
		},
	);
});

test("有効にしたopt-in ruleの整形を適用する", () => {
	withTemporaryTree({ "mixed.md": "- 一つ目\n* 二つ目\n" }, (directory) => {
		const file = join(directory, "mixed.md");

		expect(fixFiles([file])).toEqual([]);
		expect(fixFiles([file], ["list-marker-consistency"])).toEqual([file]);
		expect(readFileSync(file, "utf8")).toBe("- 一つ目\n- 二つ目\n");
	});
});

test("--disableで既定で有効なruleの検出を取り消す", () => {
	withTemporaryTree({ "a.md": "本文です  \n" }, (directory) => {
		const files = [join(directory, "a.md")];
		expect(lintFiles(files, directory).length).toBeGreaterThan(0);
		expect(lintFiles(files, directory, [], ["trailing-whitespace"])).toEqual(
			[],
		);
	});
});
