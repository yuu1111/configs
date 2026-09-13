import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectFiles } from "@yuu1111/shared/files";
import { SUPPORTED_EXTENSIONS, scanSource } from "../src/scan";

describe("file collection", () => {
	test("skips an ignored path", () => {
		const root = mkdtempSync(join(tmpdir(), "comment-check-"));
		try {
			mkdirSync(join(root, "src", "generated"), { recursive: true });
			writeFileSync(join(root, "src", "a.ts"), "export const a = 1\n");
			writeFileSync(
				join(root, "src", "generated", "b.ts"),
				"// TODO: generated\n",
			);
			const files = collectFiles(["."], {
				cwd: root,
				extensions: SUPPORTED_EXTENSIONS,
				ignores: ["src/generated"],
			});
			expect(
				files.map((file) => file.replace(root, "").split("\\").join("/")),
			).toEqual(["/src/a.ts"]);
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	});
});

describe("source scanning", () => {
	test("reports the position of a finding", () => {
		const findings = scanSource("const a = 1\n// TODO: remove\n", "src/a.ts");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.line).toBe(2);
		expect(findings[0]?.column).toBe(1);
	});

	test("keeps the opt-in rule off by default", () => {
		expect(scanSource("// 説明。\n", "src/a.ts")).toEqual([]);
	});

	test("reports the period of a line comment at its own position", () => {
		expect(scanSource("// あ。\n", "src/a.ts", ["japanese-period"])).toEqual([
			{
				column: 5,
				file: "src/a.ts",
				line: 1,
				rule: "japanese-period",
				text: "あ。",
			},
		]);
	});

	test("reports the period of a block comment on its own line", () => {
		expect(
			scanSource("const value = 1\n/* あ。 */\n", "src/a.ts", [
				"japanese-period",
			]),
		).toEqual([
			{
				column: 5,
				file: "src/a.ts",
				line: 2,
				rule: "japanese-period",
				text: "あ。",
			},
		]);
	});

	test("reports the period inside a TSDoc comment", () => {
		const source = "/**\n * あ。\n */\nexport const value = 1\n";
		expect(scanSource(source, "src/a.ts", ["japanese-period"])).toEqual([
			{
				column: 5,
				file: "src/a.ts",
				line: 2,
				rule: "japanese-period",
				text: "あ。",
			},
		]);
	});

	test("keeps periods inside strings, templates, and regex literals out", () => {
		const source = [
			'const url = "https://例。com"',
			"const label = `本文。です`",
			"const pattern = /[あ。]/",
			"const value = 1 // 本物。",
		].join("\n");
		const findings = scanSource(source, "src/a.ts", ["japanese-period"]);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.line).toBe(4);
		expect(findings[0]?.text).toBe("本物。");
	});

	test("reports a comment inside a template expression", () => {
		const open = "${";
		const source = `const label = \`a ${open}value /* 内。 */}\`\n`;
		const findings = scanSource(source, "src/a.ts", ["japanese-period"]);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.text).toBe("内。");
	});

	test("reports one finding for a comment with several periods", () => {
		const findings = scanSource("// 一つ。二つ。\n", "src/a.ts", [
			"japanese-period",
		]);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.column).toBe(6);
	});

	test("keeps the cramped comment rule off by default", () => {
		const source = "const a = 1\n/**\n * b\n */\nexport const b = 1\n";
		expect(scanSource(source, "src/a.ts")).toEqual([]);
	});

	test("reports a multi-line comment that directly follows code", () => {
		const source = "const a = 1\n/**\n * b\n */\nexport const b = 1\n";
		expect(scanSource(source, "src/a.ts", ["cramped-comment"])).toEqual([
			{
				column: 1,
				file: "src/a.ts",
				line: 2,
				rule: "cramped-comment",
				text: "b",
			},
		]);
	});

	test("accepts a multi-line comment after a blank line", () => {
		const source = "const a = 1\n\n/**\n * b\n */\nexport const b = 1\n";
		expect(scanSource(source, "src/a.ts", ["cramped-comment"])).toEqual([]);
	});

	test("accepts a single-line comment and a comment that opens a block", () => {
		const single = "const a = 1\n/** b */\nexport const b = 1\n";
		expect(scanSource(single, "src/a.ts", ["cramped-comment"])).toEqual([]);
		const block =
			"export interface A {\n\t/**\n\t * b\n\t */\n\tb: string;\n}\n";
		expect(scanSource(block, "src/a.ts", ["cramped-comment"])).toEqual([]);
	});
});

describe("disabled rules", () => {
	test("drops a finding for a rule turned off by default", () => {
		expect(
			scanSource("// TODO: remove\n", "src/a.ts", [], ["placeholder-comment"]),
		).toEqual([]);
	});

	test("keeps the findings of the other rules", () => {
		expect(
			scanSource("// TODO: remove\n", "src/a.ts", [], ["separator-comment"]),
		).toHaveLength(1);
	});
});
