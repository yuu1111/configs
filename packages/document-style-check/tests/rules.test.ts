import { expect, test } from "bun:test";
import { fixSource, lintSource } from "../src/rules";

/**
 * 検出したrule名だけを位置順に返す
 */
function rulesOf(source: string): string[] {
	return lintSource(source, "doc.md").map((finding) => finding.rule);
}

test("行末の空白を検出して取り除く", () => {
	const source = "本文です  \n次の行です\n";

	expect(lintSource(source, "doc.md")).toEqual([
		{
			column: 5,
			file: "doc.md",
			line: 1,
			message: "trailing whitespace is not part of the content",
			rule: "trailing-whitespace",
			severity: "error",
		},
	]);
	expect(fixSource(source)).toBe("本文です\n次の行です\n");
});

test("本文中の強制改行を検出して取り除く", () => {
	expect(rulesOf("前の文<br>後の文\n")).toEqual(["hard-break-html"]);
	expect(rulesOf("前の文<br/>後の文\n")).toEqual(["hard-break-html"]);
	expect(fixSource("前の文<br>後の文\n")).toBe("前の文後の文\n");
});

test("インラインコード内の強制改行は対象外にする", () => {
	expect(rulesOf("`<br>` はコード表記です\n")).toEqual([]);
	expect(fixSource("`<br>` はコード表記です\n")).toBe(
		"`<br>` はコード表記です\n",
	);
});

test("行末のバックスラッシュを検出して取り除く", () => {
	const source = "末尾にバックスラッシュ\\\n";

	expect(rulesOf(source)).toEqual(["trailing-backslash"]);
	expect(fixSource(source)).toBe("末尾にバックスラッシュ\n");
});

test("見出しや箇条書きの行末バックスラッシュは対象外にする", () => {
	expect(rulesOf("## 見出し\\\n")).toEqual([]);
	expect(rulesOf("- 項目\\\n")).toEqual([]);
});

test("連続する空行を検出して1行へ畳む", () => {
	const source = "本文A\n\n\n\n本文B\n";

	expect(rulesOf(source)).toEqual([
		"consecutive-blank-lines",
		"consecutive-blank-lines",
	]);
	expect(fixSource(source)).toBe("本文A\n\n本文B\n");
});

test("判断に必要な日付は警告にしない", () => {
	expect(rulesOf("期限は2024-05-01です。\n")).toEqual([]);
});

test("確認した日を起点にした表現は警告にする", () => {
	const findings = lintSource("2024-05-01に確認した内容です。\n", "doc.md");

	expect(findings).toEqual([
		{
			column: 1,
			file: "doc.md",
			line: 1,
			message: "a check date is not the identity of the subject",
			rule: "date-anchored-statement",
			severity: "warning",
		},
	]);
});

test("frontmatterとコードフェンスの内容は検出しない", () => {
	const source =
		"---\ntitle: 例  \n---\n\n本文です  \n\n```text\nコード  \n```\n";

	expect(lintSource(source, "doc.md")).toHaveLength(1);
	expect(fixSource(source)).toBe(
		"---\ntitle: 例  \n---\n\n本文です\n\n```text\nコード  \n```\n",
	);
});

test("見出しや表の行末空白は取り除く", () => {
	const source = "## 見出し  \n\n| 項目 | 値 |  \n| --- | --- |\n";

	expect(fixSource(source)).toBe("## 見出し\n\n| 項目 | 値 |\n| --- | --- |\n");
});

test("BOMとCRLFを保ったまま整形する", () => {
	const source = "\uFEFF本文です  \r\n\r\n\r\n次の行です  \r\n";

	expect(fixSource(source)).toBe("\uFEFF本文です\r\n\r\n次の行です\r\n");
});

test("整形を繰り返しても結果が変わらない", () => {
	const source = "本文です  \n二行目<br>\n\n\n三行目\\\n";
	const once = fixSource(source);

	expect(fixSource(once)).toBe(once);
	expect(lintSource(once, "doc.md")).toEqual([]);
});
