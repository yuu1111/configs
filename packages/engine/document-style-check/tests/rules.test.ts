import { expect, test } from "bun:test";
import { type OptInRuleId, RULE_GROUPS, RULE_IDS } from "../src/rule-ids";
import { fixSource, lintSource } from "../src/rules";

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
		"heading-trailing-punctuation",
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
		optedRulesOf("- 項目\n  * 子項目\n", ["list-marker-consistency"]),
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

test("--disableで既定で有効なruleの検出を取り消す", () => {
	const source = "本文です  \n";
	expect(lintSource(source, "doc.md", [], ["trailing-whitespace"])).toEqual([]);
});

test("--disableで既定で有効なruleの整形を取り消す", () => {
	const source = "本文です  \n";
	expect(fixSource(source, [], ["trailing-whitespace"])).toBe(source);
});

test("--disableは無効にしていないruleの整形を止めない", () => {
	expect(fixSource("本文です  \n", [], ["hard-break-html"])).toBe("本文です\n");
});

test("--disableで連続空行の圧縮を取り消す", () => {
	const source = "本文\n\n\n次の行\n";
	expect(fixSource(source, [], ["consecutive-blank-lines"])).toBe(source);
});

test("全てのruleがgroupへ重複なく入る", () => {
	const grouped = Object.values(RULE_GROUPS).flatMap((rules) => [...rules]);
	expect(grouped.slice().sort()).toEqual([...RULE_IDS].sort());
});
test("見出しの#と本文の区切りを検出して整える", () => {
	expect(rulesOf("#見出し\n")).toEqual(["heading-space"]);
	expect(rulesOf("#  見出し\n")).toEqual(["heading-space"]);
	expect(rulesOf("# 見出し\n")).toEqual([]);
	expect(fixSource("#見出し\n")).toBe("# 見出し\n");
	expect(fixSource("#  見出し\n")).toBe("# 見出し\n");
	expect(fixSource("   ##  見出し\n")).toBe("## 見出し\n");
});

test("見出しの字下げを検出して取り除く", () => {
	expect(rulesOf("  # 見出し\n")).toEqual(["heading-indent"]);
	expect(rulesOf(" # 見出し\n")).toEqual(["heading-indent"]);
	expect(rulesOf("# 見出し\n")).toEqual([]);
	expect(fixSource("  # 見出し\n")).toBe("# 見出し\n");
	expect(fixSource("   ## 見出し\n")).toBe("## 見出し\n");
	expect(rulesOf("> # 引用内の見出し\n")).toEqual([]);
	expect(fixSource("    # コードブロック\n")).toBe("    # コードブロック\n");
});

test("見出しの前後の空行不足を検出して空行を入れる", () => {
	const source = "本文です\n# 見出し\n本文です\n";
	expect(rulesOf(source)).toEqual([
		"heading-blank-lines",
		"heading-blank-lines",
	]);
	const fixed = "本文です\n\n# 見出し\n\n本文です\n";
	expect(fixSource(source)).toBe(fixed);
	expect(fixSource(fixed)).toBe(fixed);
	expect(rulesOf(fixed)).toEqual([]);
});

test("先頭と末尾の見出しに空行を求めない", () => {
	expect(rulesOf("# 見出し\n")).toEqual([]);
	expect(rulesOf("本文です\n\n# 見出し\n")).toEqual([]);
	expect(fixSource("# 見出し\n\n本文です\n")).toBe("# 見出し\n\n本文です\n");
});

test("表の前後の空行不足を検出して空行を入れる", () => {
	const source = "本文です\n| A | B |\n| --- | --- |\n| 1 | 2 |\n本文です\n";
	expect(rulesOf(source)).toEqual(["table-blank-lines", "table-blank-lines"]);
	const fixed = "本文です\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n本文です\n";
	expect(fixSource(source)).toBe(fixed);
	expect(fixSource(fixed)).toBe(fixed);
	expect(rulesOf(fixed)).toEqual([]);
});

test("リスト記号の後ろの区切りを半角スペース1つへ揃える", () => {
	expect(rulesOf("-  項目\n")).toEqual(["list-marker-space"]);
	expect(rulesOf("1.  項目\n")).toEqual(["list-marker-space"]);
	expect(rulesOf("\t- 項目\n")).toEqual(["hard-tabs", "indented-code-block"]);
	expect(rulesOf("- 項目\n")).toEqual([]);
	expect(fixSource("-  項目\n")).toBe("- 項目\n");
	expect(fixSource("1.  項目\n")).toBe("1. 項目\n");
	expect(fixSource("  -  項目\n")).toBe("  - 項目\n");
	expect(rulesOf("- - -\n")).toEqual([]);
});

test("setext見出しを警告する", () => {
	expect(rulesOf("見出し\n===\n")).toEqual(["setext-heading"]);
	expect(rulesOf("見出し\n---\n")).toEqual(["setext-heading"]);
	expect(rulesOf("---\n")).toEqual([]);
	expect(rulesOf("# 見出し\n\n---\n")).toEqual([]);
	expect(rulesOf("本文\n\n---\n")).toEqual([]);
	const findings = lintSource("見出し\n===\n", "doc.md");
	expect(findings.map((finding) => finding.severity)).toEqual(["warning"]);
});

test("強調だけの行を見出しの代わりに使った行として警告する", () => {
	expect(rulesOf("**注意**\n")).toEqual(["emphasis-as-heading"]);
	expect(rulesOf("*補足*\n")).toEqual(["emphasis-as-heading"]);
	expect(rulesOf("**注意。**\n")).toEqual([]);
	expect(rulesOf("本文の**一部**です\n")).toEqual([]);
	expect(rulesOf("`**注意**`\n")).toEqual([]);
	expect(rulesOf("- **注意**\n")).toEqual([]);
	const findings = lintSource("**注意**\n", "doc.md");
	expect(findings.map((finding) => finding.severity)).toEqual(["warning"]);
});

test("既定では強調記号の混在を検出しない", () => {
	expect(rulesOf("*強調* と _強調_\n")).toEqual([]);
});

test("強調記号の混在を検出して揃える", () => {
	const enabled = ["emphasis-marker"] as const;
	expect(optedRulesOf("*強調* と _強調_\n", [...enabled])).toEqual([
		"emphasis-marker",
	]);
	expect(optedRulesOf("*強調* と **強調**\n", [...enabled])).toEqual([]);
	expect(optedRulesOf("_敵対_ と **敵対**\n", [...enabled])).toEqual([
		"emphasis-marker",
	]);
	expect(fixSource("*強調* と _強調_\n", [...enabled])).toBe(
		"*強調* と *強調*\n",
	);
	expect(fixSource("_強調_ と **強調**\n", [...enabled])).toBe(
		"_強調_ と __強調__\n",
	);
	expect(optedRulesOf("foo_bar_baz という名前\n", [...enabled])).toEqual([]);
});

test("既定では区切り線の流儀の混在を検出しない", () => {
	expect(rulesOf("本文\n\n---\n\n本文\n\n***\n")).toEqual([]);
});

test("区切り線の流儀の混在を検出して揃える", () => {
	const enabled = ["thematic-break-style"] as const;
	const source = "本文\n\n---\n\n本文\n\n***\n";
	expect(optedRulesOf(source, [...enabled])).toEqual(["thematic-break-style"]);
	const fixed = "本文\n\n---\n\n本文\n\n---\n";
	expect(fixSource(source, [...enabled])).toBe(fixed);
	expect(optedRulesOf(fixed, [...enabled])).toEqual([]);
	expect(optedRulesOf("本文\n\n---\n\n本文\n\n- - -\n", [...enabled])).toEqual([
		"thematic-break-style",
	]);
});

test("既定ではフェンス記号の混在を検出しない", () => {
	expect(rulesOf("```js\ncode\n```\n\n~~~js\ncode\n~~~\n")).toEqual([]);
});

test("フェンス記号の混在を検出して揃える", () => {
	const enabled = ["fence-style"] as const;
	const source = "```js\ncode\n```\n\n~~~js\ncode\n~~~\n";
	expect(optedRulesOf(source, [...enabled])).toEqual(["fence-style"]);
	const fixed = "```js\ncode\n```\n\n```js\ncode\n```\n";
	expect(fixSource(source, [...enabled])).toBe(fixed);
	expect(optedRulesOf(fixed, [...enabled])).toEqual([]);
});

test("--disableで新しいruleの検出と整形を取り消す", () => {
	expect(
		lintSource("本文です\n# 見出し\n", "doc.md", [], ["heading-blank-lines"]),
	).toEqual([]);
	expect(fixSource("  # 見出し\n", [], ["heading-indent"])).toBe(
		"  # 見出し\n",
	);
	expect(fixSource("-  項目\n", [], ["list-marker-space"])).toBe("-  項目\n");
	expect(lintSource("  # 見出し\n", "doc.md", [], ["heading-indent"])).toEqual(
		[],
	);
});

test("フェンス前後の空行不足を検出して空行を入れる", () => {
	const source = "本文です\n```js\ncode\n```\n続きです\n";
	expect(rulesOf(source)).toEqual(["fence-blank-lines", "fence-blank-lines"]);
	const fixed = "本文です\n\n```js\ncode\n```\n\n続きです\n";
	expect(fixSource(source)).toBe(fixed);
	expect(fixSource(fixed)).toBe(fixed);
	expect(rulesOf(fixed)).toEqual([]);
});

test("リスト前後の空行不足を検出して空行を入れる", () => {
	const source = "本文です\n- 項目A\n- 項目B\n続きです\n";
	expect(rulesOf(source)).toEqual(["list-blank-lines", "list-blank-lines"]);
	const fixed = "本文です\n\n- 項目A\n- 項目B\n\n続きです\n";
	expect(fixSource(source)).toBe(fixed);
	expect(rulesOf(fixed)).toEqual([]);
});

test("文書の先頭と末尾のリストに空行を求めない", () => {
	expect(rulesOf("- 項目A\n- 項目B\n")).toEqual([]);
	expect(rulesOf("1. 項目A\n2. 項目B\n")).toEqual([]);
});

test("末尾の改行不足と重複を検出して単一改行へ整える", () => {
	expect(rulesOf("本文です")).toEqual(["single-trailing-newline"]);
	expect(fixSource("本文です")).toBe("本文です\n");
	expect(rulesOf("本文です\n\n")).toEqual([
		"consecutive-blank-lines",
		"single-trailing-newline",
	]);
	expect(fixSource("本文です\n\n")).toBe("本文です\n");
});

test("ハードタブを検出してスペースへ置き換える", () => {
	expect(rulesOf("a\tb\n")).toEqual(["hard-tabs"]);
	expect(fixSource("a\tb\n")).toBe("a  b\n");
	expect(fixSource("a\tb\n", [], ["hard-tabs"])).toBe("a\tb\n");
});

test("見出し末尾の句読点を警告する", () => {
	expect(rulesOf("## 使い方。\n")).toEqual(["heading-trailing-punctuation"]);
	expect(rulesOf("## 使い方\n")).toEqual([]);
	expect(rulesOf("## 使い方 ##\n")).toEqual([]);
	const findings = lintSource("## 使い方。\n", "doc.md");
	expect(findings.map((finding) => finding.severity)).toEqual(["warning"]);
	expect(fixSource("## 使い方。\n")).toBe("## 使い方。\n");
});

test("逆順リンクを検出する", () => {
	expect(rulesOf("(説明)[https://example.com]\n")).toEqual(["reversed-link"]);
	expect(rulesOf("[説明](https://example.com)\n")).toEqual([]);
	expect(rulesOf("(例)[^1]\n")).toEqual([]);
	expect(rulesOf("`(a)[b]` の形を説明する\n")).toEqual([]);
});

test("既定では順序リストの採番混在を検出しない", () => {
	expect(rulesOf("1. 項目A\n1. 項目B\n2. 項目C\n")).toEqual([]);
});

test("順序リストの採番混在を検出する", () => {
	const enabled = ["ordered-list-marker"] as const;
	const mixed = "1. 項目A\n1. 項目B\n2. 項目C\n";
	const found = lintSource(mixed, "doc.md", [...enabled]);
	expect(found.map((finding) => finding.rule)).toEqual(["ordered-list-marker"]);
	expect(found[0]?.line).toBe(3);
	expect(optedRulesOf("1. 項目A\n2. 項目B\n3. 項目C\n", [...enabled])).toEqual(
		[],
	);
	expect(optedRulesOf("1. 項目A\n1. 項目B\n", [...enabled])).toEqual([]);
	expect(optedRulesOf("1. 項目A\n1) 項目B\n", [...enabled])).toEqual([
		"ordered-list-marker",
	]);
});

test("--disableで追加したruleの検出と整形を取り消す", () => {
	expect(
		lintSource(
			"#見出し",
			"doc.md",
			[],
			["heading-space", "single-trailing-newline"],
		),
	).toEqual([]);
	expect(
		fixSource("本文\n```js\ncode\n```\n続き\n", [], ["fence-blank-lines"]),
	).toBe("本文\n```js\ncode\n```\n続き\n");
});

test("角括弧で囲まれていないURLを検出して囲む", () => {
	expect(rulesOf("仕様は https://example.com/spec にある\n")).toEqual([
		"bare-url",
	]);
	expect(rulesOf("仕様は <https://example.com/spec> にある\n")).toEqual([]);
	expect(rulesOf("仕様は [仕様書](https://example.com/spec) にある\n")).toEqual(
		[],
	);
	expect(rulesOf("`https://example.com` はコード表記です\n")).toEqual([]);
	expect(fixSource("仕様は https://example.com/spec にある\n")).toBe(
		"仕様は <https://example.com/spec> にある\n",
	);
	expect(fixSource("参照: https://example.com/a, 続き\n")).toBe(
		"参照: <https://example.com/a>, 続き\n",
	);
});

test("強調記号の内側の空白を検出して取り除く", () => {
	expect(rulesOf("これは ** 強調 ** です\n")).toEqual(["emphasis-padding"]);
	expect(rulesOf("これは * 強調* です\n")).toEqual(["emphasis-padding"]);
	expect(rulesOf("これは **強調** です\n")).toEqual([]);
	expect(rulesOf("`** 強調 **` はコード表記です\n")).toEqual([]);
	expect(rulesOf("- - -\n")).toEqual([]);
	expect(fixSource("これは ** 強調 ** です\n")).toBe("これは **強調** です\n");
	expect(fixSource("これは * 強調 * です\n")).toBe("これは *強調* です\n");
});

test("コードスパンの内側の空白を検出して取り除く", () => {
	expect(rulesOf("これは ` コード ` です\n")).toEqual(["code-span-padding"]);
	expect(rulesOf("これは `コード` です\n")).toEqual([]);
	expect(rulesOf("これは ` コード` です\n")).toEqual([]);
	expect(fixSource("これは ` コード ` です\n")).toBe("これは `コード` です\n");
});

test("リンクテキストの内側の空白を検出して取り除く", () => {
	expect(rulesOf("[ 仕様書 ](https://example.com)\n")).toEqual([
		"link-label-padding",
	]);
	expect(rulesOf("[仕様書](https://example.com)\n")).toEqual([]);
	expect(rulesOf("![ 図 ](diagram.png)\n")).toEqual([]);
	expect(fixSource("[ 仕様書 ](https://example.com)\n")).toBe(
		"[仕様書](https://example.com)\n",
	);
});

test("行き先を説明しないリンクテキストを検出する", () => {
	expect(rulesOf("詳細は[こちら](https://example.com)を参照\n")).toEqual([
		"descriptive-link-text",
	]);
	expect(rulesOf("詳細は[here](https://example.com)を参照\n")).toEqual([
		"descriptive-link-text",
	]);
	expect(rulesOf("詳細は[仕様書](https://example.com)を参照\n")).toEqual([]);
	expect(rulesOf("詳細は[こちらの資料](https://example.com)を参照\n")).toEqual(
		[],
	);
	expect(rulesOf("![こちら](diagram.png)\n")).toEqual([]);
});

test("字下げコードブロックを検出する", () => {
	expect(rulesOf("説明です\n\n    const x = 1;\n")).toEqual([
		"indented-code-block",
	]);
	expect(rulesOf("    const x = 1;\n")).toEqual(["indented-code-block"]);
	expect(rulesOf("```js\nconst x = 1;\n```\n")).toEqual([]);
	expect(rulesOf("- 項目\n\n    継続段落\n")).toEqual([]);
	expect(rulesOf("- 項目\n    継続行\n")).toEqual([]);
});

test("見出しより列の多い表の行を検出する", () => {
	expect(rulesOf("| A | B |\n| --- | --- |\n| 1 | 2 | 3 |\n")).toEqual([
		"table-column-count",
	]);
	expect(rulesOf("| A | B |\n| --- | --- |\n| 1 | 2 |\n")).toEqual([]);
	expect(rulesOf("| A | B |\n| --- | --- |\n| 1 |\n")).toEqual([]);
	expect(rulesOf("| `a|b` | c |\n| --- | --- |\n| 1 | 2 |\n")).toEqual([]);
});

test("既定ではトップレベル見出しの重複と先頭の見出しを検査しない", () => {
	expect(rulesOf("# 一つ目\n\n# 二つ目\n")).toEqual([]);
	expect(rulesOf("## 見出しから始まる文書\n")).toEqual([]);
});

test("トップレベル見出しの重複を検出する", () => {
	const enabled = ["single-top-level-heading"] as const;
	expect(optedRulesOf("# 一つ目\n\n# 二つ目\n", [...enabled])).toEqual([
		"single-top-level-heading",
	]);
	expect(optedRulesOf("# 一つ目\n\n## 節\n", [...enabled])).toEqual([]);
});

test("先頭のトップレベル見出しの不足を検出する", () => {
	const enabled = ["first-line-heading"] as const;
	expect(optedRulesOf("## 見出しから始まる文書\n", [...enabled])).toEqual([
		"first-line-heading",
	]);
	expect(optedRulesOf("# 見出し\n\n本文\n", [...enabled])).toEqual([]);
	expect(
		optedRulesOf("---\ntitle: x\n---\n\n# 見出し\n", [...enabled]),
	).toEqual([]);
});

test("--disableで今回追加したruleの検出と整形を取り消す", () => {
	expect(
		lintSource("参照: https://example.com\n", "doc.md", [], ["bare-url"]),
	).toEqual([]);
	expect(fixSource("参照: https://example.com\n", [], ["bare-url"])).toBe(
		"参照: https://example.com\n",
	);
	expect(fixSource("これは ` コード ` です\n", [], ["code-span-padding"])).toBe(
		"これは ` コード ` です\n",
	);
	expect(fixSource("これは ** 強調 ** です\n", [], ["emphasis-padding"])).toBe(
		"これは ** 強調 ** です\n",
	);
	expect(
		fixSource("[ 仕様書 ](https://example.com)\n", [], ["link-label-padding"]),
	).toBe("[ 仕様書 ](https://example.com)\n");
});
