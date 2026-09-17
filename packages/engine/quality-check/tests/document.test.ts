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

test("lintは既定でopt-in ruleを実行しない", () => {
	expect(parseArguments(["lint", "."]).enabled).toEqual([]);
	expect(parseArguments(["lint", "."]).disabled).toEqual([]);
});

test("lintの--preset allで全opt-in ruleを有効にする", () => {
	expect(parseArguments(["lint", "--preset", "all", "."]).enabled).toEqual([
		"emphasis-marker",
		"fence-style",
		"first-line-heading",
		"full-width-alphanumeric",
		"japanese-comma",
		"japanese-period",
		"list-marker-consistency",
		"ordered-list-marker",
		"single-top-level-heading",
		"table-style",
		"thematic-break-style",
	]);
});

test("lintの--preset noneで既定のruleを無効にする", () => {
	expect(parseArguments(["lint", "--preset", "none", "."]).disabled).toEqual([
		"bare-url",
		"blockquote-blank",
		"blockquote-space",
		"code-fence-language",
		"code-span-padding",
		"command-prompt",
		"consecutive-blank-lines",
		"date-anchored-statement",
		"descriptive-link-text",
		"duplicate-heading",
		"emphasis-as-heading",
		"emphasis-padding",
		"empty-link",
		"fence-blank-lines",
		"hard-break-html",
		"hard-tabs",
		"heading-blank-lines",
		"heading-indent",
		"heading-level-jump",
		"heading-space",
		"heading-trailing-punctuation",
		"indented-code-block",
		"link-label-padding",
		"list-blank-lines",
		"list-indent",
		"list-marker-space",
		"reversed-link",
		"setext-heading",
		"single-trailing-newline",
		"table-blank-lines",
		"table-column-count",
		"trailing-backslash",
		"trailing-whitespace",
	]);
});

test("lintの--preset allへ--disableを重ねられる", () => {
	const options = parseArguments([
		"lint",
		"--preset",
		"all",
		"--disable",
		"japanese-period",
		".",
	]);
	expect(options.enabled).toEqual([
		"emphasis-marker",
		"fence-style",
		"first-line-heading",
		"full-width-alphanumeric",
		"japanese-comma",
		"list-marker-consistency",
		"ordered-list-marker",
		"single-top-level-heading",
		"table-style",
		"thematic-break-style",
	]);
	expect(options.disabled).toEqual(["japanese-period"]);
});

test("lintの--preset allでopt-in ruleの検出を報告する", () => {
	const root = mkdtempSync(join(tmpdir(), "quality-check-document-"));
	try {
		writeFileSync(join(root, "doc.md"), "# 見出し\n\n本文です。\n", "utf8");
		const report = runMain(["lint", "--preset", "all", root]);

		expect(report.code).toBe(1);
		expect(report.output).toContain("japanese-period");
		expect(report.output).toContain("1 errors");
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("lintの--presetに未知の値を拒否する", () => {
	expect(() => parseArguments(["lint", "--preset", "strict", "."])).toThrow(
		'--preset must be "recommended", "all" or "none": strict',
	);
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
