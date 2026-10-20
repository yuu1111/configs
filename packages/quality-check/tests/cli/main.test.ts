import { expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../../src/cli/main";

/**
 * mainの出力を抑えて終了codeだけを返す
 */
async function runMain(argv: string[], cwd: string): Promise<number> {
	const spy = spyOn(console, "log").mockImplementation(() => undefined);
	try {
		return await main(argv, cwd);
	} finally {
		spy.mockRestore();
	}
}

function writeConfig(root: string, value: unknown): void {
	writeFileSync(join(root, "quality.json"), JSON.stringify(value), "utf8");
}

test("engine選択と--update-baselineの併用を拒否する", async () => {
	const root = mkdtempSync(join(tmpdir(), "quality-check-cli-"));
	try {
		writeConfig(root, { code: { enabled: true } });
		await expect(runMain(["--update-baseline", "code"], root)).rejects.toThrow(
			"--update-baseline runs every enabled engine",
		);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("無効なengineの選択を拒否する", async () => {
	const root = mkdtempSync(join(tmpdir(), "quality-check-cli-"));
	try {
		writeConfig(root, { code: { enabled: true } });
		await expect(runMain(["comment"], root)).rejects.toThrow(
			"comment is not enabled",
		);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("選択したengineだけを実行する", async () => {
	const root = mkdtempSync(join(tmpdir(), "quality-check-cli-"));
	try {
		writeConfig(root, {
			code: { enabled: true },
			comment: { enabled: true },
		});
		const code = await runMain(["comment"], root);
		expect(code).toBe(0);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test.each([{ argv: ["markdown"] }, { argv: ["markdown", "doc.md"] }])(
	"markdownのengine選択を個別コマンドと区別する: %j",
	async ({ argv }) => {
		const root = mkdtempSync(join(tmpdir(), "quality-markdown-selection-"));
		try {
			writeConfig(root, { markdown: { rules: { "japanese-period": "on" } } });
			writeFileSync(join(root, "doc.md"), "本文です.\n");
			expect(await runMain([...argv], root)).toBe(1);
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	},
);

test("markdownのlintを指定cwdで起動する", async () => {
	const root = mkdtempSync(join(tmpdir(), "quality-markdown-command-"));
	try {
		writeFileSync(join(root, "doc.md"), "本文です.\n");
		expect(
			await runMain(
				["markdown", "lint", "--enable", "japanese-period", "doc.md"],
				root,
			),
		).toBe(1);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});
