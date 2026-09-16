import { expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../src/cli";

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
		writeConfig(root, { "code-style-check": { enabled: true } });
		await expect(
			runMain(["--update-baseline", "code-style-check"], root),
		).rejects.toThrow("--update-baseline runs every enabled engine");
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("無効なengineの選択を拒否する", async () => {
	const root = mkdtempSync(join(tmpdir(), "quality-check-cli-"));
	try {
		writeConfig(root, { "code-style-check": { enabled: true } });
		await expect(runMain(["comment-check"], root)).rejects.toThrow(
			"comment-check is not enabled",
		);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("選択したengineだけを実行する", async () => {
	const root = mkdtempSync(join(tmpdir(), "quality-check-cli-"));
	try {
		writeConfig(root, {
			"code-style-check": { enabled: true },
			"comment-check": { enabled: true },
		});
		const code = await runMain(["comment-check"], root);
		expect(code).toBe(0);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});
