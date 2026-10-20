import { expect, spyOn, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../src/cli";

const baselineEntry = {
	count: 1,
	engine: "document-style-check",
	file: "doc.md",
	rule: "trailing-whitespace",
	text: "trailing whitespace is not part of the content",
};

/**
 * 一時ディレクトリへworkspaceを作り、後片付けする
 */
async function withWorkspace(
	callback: (directory: string) => Promise<void>,
): Promise<void> {
	const directory = mkdtempSync(join(tmpdir(), "quality-check-baseline-"));
	try {
		await callback(directory);
	} finally {
		rmSync(directory, { force: true, recursive: true });
	}
}

/**
 * 検出が1件出るworkspaceを書く
 */
function writeWorkspace(directory: string): void {
	writeFileSync(
		join(directory, "quality.json"),
		JSON.stringify({ "document-style-check": { enabled: true } }, null, "\t"),
		"utf8",
	);
	writeFileSync(join(directory, "doc.md"), "本文です  \n", "utf8");
}

/**
 * 出力を集めて終了codeと一緒に返す
 */
async function run(
	directory: string,
	argv: string[] = [],
): Promise<{ code: number; output: string }> {
	let output = "";
	const spy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
		output += `${args.map((arg) => String(arg)).join(" ")}\n`;
	});
	try {
		return { code: await main(argv, directory), output };
	} finally {
		spy.mockRestore();
	}
}

test("reports a finding that no baseline covers", async () => {
	await withWorkspace(async (directory) => {
		writeWorkspace(directory);
		const result = await run(directory);

		expect(result.code).toBe(1);
		expect(result.output).toContain("1 new");
	});
});

test("keeps a baselined finding out of the report", async () => {
	await withWorkspace(async (directory) => {
		writeWorkspace(directory);
		writeFileSync(
			join(directory, "quality-baseline.json"),
			JSON.stringify({ entries: [baselineEntry], version: 1 }, null, "\t"),
			"utf8",
		);
		const result = await run(directory);

		expect(result.code).toBe(0);
		expect(result.output).toContain("0 new, 0 resolved");
		expect(result.output).not.toContain("trailing-whitespace");
	});
});

test("replaces the baseline with the current findings", async () => {
	await withWorkspace(async (directory) => {
		writeWorkspace(directory);
		const result = await run(directory, ["--update-baseline"]);

		expect(result.code).toBe(0);
		const written: unknown = JSON.parse(
			readFileSync(join(directory, "quality-baseline.json"), "utf8"),
		);
		expect(written).toEqual({ entries: [baselineEntry], version: 1 });
	});
});

test("rejects a baseline of another version", async () => {
	await withWorkspace(async (directory) => {
		writeWorkspace(directory);
		writeFileSync(
			join(directory, "quality-baseline.json"),
			JSON.stringify({ entries: [], version: 2 }),
			"utf8",
		);
		await expect(main([], directory)).rejects.toThrow(
			"is not a version 1 baseline",
		);
	});
});
