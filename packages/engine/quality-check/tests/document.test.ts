import { expect, spyOn, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, parseArguments } from "../src/document";

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
	const root = mkdtempSync(join(tmpdir(), "quality-check-document-"));
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
	const root = mkdtempSync(join(tmpdir(), "quality-check-document-"));
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

test("lintの--enableを複数指定できる", () => {
	expect(
		parseArguments([
			"lint",
			"--enable",
			"japanese-comma",
			"--enable",
			"list-marker-consistency",
			".",
		]).enabled,
	).toEqual(["japanese-comma", "list-marker-consistency"]);
});

test("--writeで有効にしたopt-in ruleも整形する", () => {
	const root = mkdtempSync(join(tmpdir(), "quality-check-document-"));
	try {
		const file = join(root, "doc.md");
		writeFileSync(file, "- 一つ目\n* 二つ目\n", "utf8");

		const skipped = runMain(["lint", "--write", root]);
		expect(readFileSync(file, "utf8")).toBe("- 一つ目\n* 二つ目\n");
		expect(skipped.output).not.toContain("Fixed");

		const report = runMain([
			"lint",
			"--write",
			"--enable",
			"list-marker-consistency",
			root,
		]);
		expect(readFileSync(file, "utf8")).toBe("- 一つ目\n- 二つ目\n");
		expect(report.output).toContain("Fixed");
		expect(report.code).toBe(0);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("--enableと--disableに同じruleを渡すと拒否する", () => {
	expect(() =>
		parseArguments([
			"lint",
			"--enable",
			"japanese-period",
			"--disable",
			"japanese-period",
			".",
		]),
	).toThrow("a rule cannot be enabled and disabled: japanese-period");
});
