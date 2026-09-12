import { expect, test } from "bun:test";
import { fixSource, lintSource, type OptInRuleId } from "../src/rules";

/**
 * 検出したrule名だけを位置順に返す
 */
function rulesOf(source: string): string[] {
	return lintSource(source, "doc.md").map((finding) => finding.rule);
}

/**
 * opt-in ruleを有効にした検出のrule名だけを位置順に返す
 */
function enabledRulesOf(source: string): string[] {
	return optedRulesOf(source, ["japanese-period"]);
}

/**
 * 指定したopt-in ruleを有効にした検出のrule名だけを位置順に返す
 */
function optedRulesOf(
	source: string,
	enabled: readonly OptInRuleId[],
): string[] {
	return lintSource(source, "doc.md", enabled).map((finding) => finding.rule);
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

test("既定では日本語の句点を検出しない", () => {
	expect(rulesOf("本文です。\n")).toEqual([]);
});

test("本文、見出し、箇条書き、表の句点を検出する", () => {
	const source = [
		"# 見出しです。",
		"",
		"本文です。",
		"",
		"- 項目です。",
		"",
		"| 列です。 | 値 |",
		"| --- | --- |",
		"",
	].join("\n");

	expect(enabledRulesOf(source)).toEqual([
		"japanese-period",
		"japanese-period",
		"japanese-period",
		"japanese-period",
	]);
});

test("frontmatterの句点を検出しない", () => {
	expect(enabledRulesOf("---\ntitle: 題名です。\n---\n\n本文\n")).toEqual([]);
});

test("コードフェンスの句点を検出しない", () => {
	expect(enabledRulesOf("```text\nコードです。\n```\n")).toEqual([]);
});

test("閉じたコードフェンスの後も句点を検出する", () => {
	expect(enabledRulesOf("```text\nコードです。\n```\n\n本文です。\n")).toEqual([
		"japanese-period",
	]);
});

test("インラインコードの句点を検出しない", () => {
	expect(enabledRulesOf("`コードです。` を説明する\n")).toEqual([]);
});

test("句点の位置を行と桁で報告する", () => {
	expect(
		lintSource("`コードです。` を含む本文です。\n", "doc.md", [
			"japanese-period",
		]),
	).toEqual([
		{
			column: 17,
			file: "doc.md",
			line: 1,
			message: "a Japanese sentence does not end with a period",
			rule: "japanese-period",
			severity: "error",
		},
	]);
});

test("整形しても句点を削除しない", () => {
	const fixed = fixSource("本文です。  \n");

	expect(fixed).toBe("本文です。\n");
	expect(rulesOf(fixed)).toEqual([]);
	expect(enabledRulesOf(fixed)).toEqual(["japanese-period"]);
});

test("既定では日本語の半角カンマを検出しない", () => {
	expect(rulesOf("日本語,テキスト\n")).toEqual([]);
});

test("日本語に隣接する半角カンマを検出する", () => {
	expect(
		lintSource("日本語,テキストです\n", "doc.md", ["japanese-comma"]),
	).toEqual([
		{
			column: 4,
			file: "doc.md",
			line: 1,
			message:
				"a Japanese sentence does not separate clauses with a half-width comma",
			rule: "japanese-comma",
			severity: "error",
		},
	]);
});

test("英数字の並びの半角カンマは対象外にする", () => {
	expect(optedRulesOf("a, b and c, d\n", ["japanese-comma"])).toEqual([]);
});

test("インラインコードの半角カンマは対象外にする", () => {
	expect(
		optedRulesOf("`日本語,テキスト` を説明する\n", ["japanese-comma"]),
	).toEqual([]);
});

test("既定では全角英数字を検出しない", () => {
	expect(rulesOf("値はＡＢＣ１２３です\n")).toEqual([]);
});

test("全角英数字を検出する", () => {
	expect(
		lintSource("値はＡＢＣ１２３です\n", "doc.md", ["full-width-alphanumeric"]),
	).toEqual([
		{
			column: 3,
			file: "doc.md",
			line: 1,
			message: "a full-width alphanumeric is not the ASCII character",
			rule: "full-width-alphanumeric",
			severity: "error",
		},
	]);
});

test("半角英数字は対象外にする", () => {
	expect(optedRulesOf("値はABC123です\n", ["full-width-alphanumeric"])).toEqual(
		[],
	);
});

test("インラインコードの全角英数字は対象外にする", () => {
	expect(
		optedRulesOf("`ＡＢＣ１２３` を説明する\n", ["full-width-alphanumeric"]),
	).toEqual([]);
});

test("既定では箇条書き記号の混在を検出しない", () => {
	expect(rulesOf("- 一つ目\n* 二つ目\n")).toEqual([]);
});

test("最初の記号と違う箇条書き記号を検出する", () => {
	expect(
		lintSource("- 一つ目\n* 二つ目\n- 三つ目\n", "doc.md", [
			"list-marker-consistency",
		]),
	).toEqual([
		{
			column: 1,
			file: "doc.md",
			line: 2,
			message: "unordered list markers do not mix styles",
			rule: "list-marker-consistency",
			severity: "error",
		},
	]);
});

test("ネストした箇条書きも基準の記号と比べる", () => {
	expect(
		optedRulesOf("- 項目\n\t* 子項目\n", ["list-marker-consistency"]),
	).toEqual(["list-marker-consistency"]);
});

test("記号が揃った箇条書きは検出しない", () => {
	expect(
		optedRulesOf("- 一つ目\n- 二つ目\n", ["list-marker-consistency"]),
	).toEqual([]);
});

test("区切り線を箇条書きとして扱わない", () => {
	expect(
		optedRulesOf("- 一つ目\n\n---\n\n- 二つ目\n", ["list-marker-consistency"]),
	).toEqual([]);
});

test("有効にしたときだけ箇条書き記号を揃える", () => {
	const source = "- 一つ目\n* 二つ目\n";

	expect(fixSource(source)).toBe(source);
	expect(fixSource(source, ["list-marker-consistency"])).toBe(
		"- 一つ目\n- 二つ目\n",
	);
});

test("記号を揃えた本文を再度整形しても変わらない", () => {
	const fixed = fixSource("- 一つ目\n* 二つ目\n", ["list-marker-consistency"]);

	expect(fixSource(fixed, ["list-marker-consistency"])).toBe(fixed);
});

test("整形しても半角カンマと全角英数字を削除しない", () => {
	const fixed = fixSource("日本語,ＡＢＣです  \n", [
		"japanese-comma",
		"full-width-alphanumeric",
	]);

	expect(fixed).toBe("日本語,ＡＢＣです\n");
});
test("言語指定の無いフェンスを検出する", () => {
	expect(lintSource("```\nコード\n```\n", "doc.md")).toEqual([
		{
			column: 1,
			file: "doc.md",
			line: 1,
			message: "a code fence without a language renders without highlighting",
			rule: "code-fence-language",
			severity: "error",
		},
	]);
});

test("言語指定のあるフェンスは検出しない", () => {
	expect(rulesOf("```text\nコード\n```\n")).toEqual([]);
	expect(rulesOf("~~~bash\nコード\n~~~\n")).toEqual([]);
});

test("閉じるフェンスを言語指定の欠落として扱わない", () => {
	expect(rulesOf("```\nコード\n```\n")).toEqual(["code-fence-language"]);
});

test("frontmatterをフェンスとして扱わない", () => {
	expect(rulesOf("---\ntitle: 例\n---\n\n本文\n")).toEqual([]);
});

test("見出しレベルの飛びを検出する", () => {
	expect(lintSource("## 見出し\n\n#### 飛んだ見出し\n", "doc.md")).toEqual([
		{
			column: 1,
			file: "doc.md",
			line: 3,
			message: "a heading level skips a step",
			rule: "heading-level-jump",
			severity: "warning",
		},
	]);
});

test("一段ずつ増える見出しは検出しない", () => {
	expect(rulesOf("# 見出し\n\n## 見出し\n\n### 見出し\n")).toEqual([]);
});

test("最初の見出しを飛びとして扱わない", () => {
	expect(rulesOf("### 見出し\n")).toEqual([]);
});

test("コードフェンス内の見出しを飛びとして扱わない", () => {
	expect(rulesOf("## 見出し\n\n```text\n#### コード\n```\n")).toEqual([]);
});

test("空のリンクラベルまたはリンク先を検出する", () => {
	expect(rulesOf("[説明](url)\n")).toEqual([]);
	expect(rulesOf("[](url)\n")).toEqual(["empty-link"]);
	expect(rulesOf("[説明]()\n")).toEqual(["empty-link"]);
});

test("空リンクの位置を行と桁で報告する", () => {
	expect(lintSource("本文 [](url)\n", "doc.md")).toEqual([
		{
			column: 4,
			file: "doc.md",
			line: 1,
			message: "a link has no text or no destination",
			rule: "empty-link",
			severity: "error",
		},
	]);
});

test("インラインコードの空リンクは対象外にする", () => {
	expect(rulesOf("`[]()` の形を説明する\n")).toEqual([]);
});

test("画像の空のラベルは対象外にする", () => {
	expect(rulesOf("![](image.png)\n")).toEqual([]);
});

test("ラベルがインラインコードだけのリンクは対象外にする", () => {
	expect(rulesOf("[`label`](url)\n")).toEqual([]);
});
