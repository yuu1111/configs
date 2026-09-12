import { expect, spyOn, test } from "bun:test";
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
import { main, parseArguments } from "../src/cli";
import { DOCUMENT_EXTENSIONS, fixFiles, lintFiles } from "../src/scan";

/**
 * mainの出力を集めて終了codeと一緒に返す
 */
function runMain(argv: string[]): { code: number; output: string } {
	let output = "";
	const spy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
		output += `${args.map((arg) => String(arg)).join(" ")}\n`;
	});
	try {
		return { code: main(argv), output };
	} finally {
		spy.mockRestore();
	}
}

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

test("指定したpathを検査から外す", () => {
	withTemporaryTree({ "a.md": "本文\n", "sub/d.md": "本文\n" }, (directory) => {
		const files = collectFiles([directory], {
			cwd: directory,
			extensions: DOCUMENT_EXTENSIONS,
			ignores: ["sub"],
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

test("未知のrule名を拒否する", () => {
	expect(() => parseArguments(["lint", "--enable", "period", "."])).toThrow(
		"unknown rule: period",
	);
});

test("lintの--enableでopt-in ruleを有効にする", () => {
	expect(
		parseArguments(["lint", "--enable", "japanese-period", "."]).enabled,
	).toEqual(["japanese-period"]);
});

test("--enableなしではopt-in ruleを実行しない", () => {
	const root = mkdtempSync(join(tmpdir(), "document-style-cli-"));
	try {
		writeFileSync(join(root, "doc.md"), "本文です。\n", "utf8");
		const report = runMain(["lint", root]);

		expect(report.code).toBe(0);
		expect(report.output).not.toContain("japanese-period");
		expect(report.output).toContain("0 errors");
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("--enableでopt-in ruleの検出を報告する", () => {
	const root = mkdtempSync(join(tmpdir(), "document-style-cli-"));
	try {
		writeFileSync(join(root, "doc.md"), "本文です。\n", "utf8");
		const report = runMain(["lint", "--enable", "japanese-period", root]);

		expect(report.code).toBe(1);
		expect(report.output).toContain("japanese-period");
		expect(report.output).toContain("1 errors");
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});
