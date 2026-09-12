import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	closesFence,
	markdownLines,
	proseBoundaries,
	proseLineBreaks,
	proseLongLines,
	snapshot,
	verify,
} from "../src/audit";

type MutableEntry = Record<string, unknown>;

interface MutableDocument {
	boundaries: MutableEntry[];
	document: string;
	documentSha256: string;
	lineBreaks: MutableEntry[];
	longLines: MutableEntry[];
}

interface MutableReview {
	criteria: MutableEntry[];
	documents: MutableDocument[];
	rules: string;
	rulesSha256: string;
	version: number;
}

const DEFAULT_RULES = "## 判断基準\n\n### 変動する公開状況を転記しない\n";

/**
 * 範囲内の要素を取り出し、記録の欠落をテスト側の失敗として示す
 */
function at<T>(items: readonly T[], index: number): T {
	const item = items[index];
	if (item === undefined) {
		throw new Error("テストデータのindexが範囲外です");
	}
	return item;
}

/**
 * 一時ディレクトリ内の本文と基準で検証し、作成したファイルだけを後片付けする
 */
function withTemporaryFiles<T>(
	documentText: string,
	rulesText: string,
	callback: (documentPath: string, rulesPath: string) => T,
): T {
	const directory = mkdtempSync(join(tmpdir(), "document-style-check-"));
	const documentPath = join(directory, "document.md");
	const rulesPath = join(directory, "RULES.md");
	try {
		writeFileSync(documentPath, documentText, "utf8");
		writeFileSync(rulesPath, rulesText, "utf8");
		return callback(documentPath, rulesPath);
	} finally {
		rmSync(directory, { force: true, recursive: true });
	}
}

/**
 * 複数文書を一時ディレクトリへ置き、作成したファイルだけを後片付けする
 */
function withTemporaryDocuments<T>(
	texts: string[],
	rulesText: string,
	callback: (documentPaths: string[], rulesPath: string) => T,
): T {
	const directory = mkdtempSync(join(tmpdir(), "document-style-check-"));
	const documentPaths = texts.map((text, index) => {
		const path = join(directory, `document-${index}.md`);
		writeFileSync(path, text, "utf8");
		return path;
	});
	const rulesPath = join(directory, "RULES.md");
	writeFileSync(rulesPath, rulesText, "utf8");
	try {
		return callback(documentPaths, rulesPath);
	} finally {
		rmSync(directory, { force: true, recursive: true });
	}
}

/**
 * 記録の網羅性を検証するため、判断欄を埋めたテスト用データを作る
 */
function reviewedSnapshot(
	documentPath: string,
	rulesPath: string,
): MutableReview {
	const review = snapshot([documentPath], rulesPath);
	const mutable: MutableReview = {
		criteria: review.criteria.map((criterion) => ({ ...criterion })),
		documents: review.documents.map((document) => ({
			boundaries: document.boundaries.map((entry) => ({ ...entry })),
			document: document.document,
			documentSha256: document.documentSha256,
			lineBreaks: document.lineBreaks.map((entry) => ({ ...entry })),
			longLines: document.longLines.map((entry) => ({ ...entry })),
		})),
		rules: review.rules,
		rulesSha256: review.rulesSha256,
		version: review.version,
	};
	for (const criterion of mutable.criteria) {
		criterion.decision = "checked";
		criterion.evidence =
			"本文に最新版や公開状況の手書き転記がないことを確認した";
	}
	for (const document of mutable.documents) {
		for (const boundary of document.boundaries) {
			boundary.decision = "keep";
			boundary.reason =
				"前段は設定条件、後段は障害時の実行手順で、読者が別に判断する内容のため";
		}
		for (const lineBreak of document.lineBreaks) {
			lineBreak.decision = "keep";
			lineBreak.reason = "詩の改行が表示上の意味を持つため";
		}
		for (const longLine of document.longLines) {
			longLine.decision = "keep";
			longLine.reason = "テスト用の分割しない値として構成したため";
		}
	}
	return mutable;
}

/**
 * 変異テスト同士が干渉しないよう検証記録を複製する
 */
function cloneReview(review: MutableReview): MutableReview {
	const cloned: MutableReview = JSON.parse(JSON.stringify(review));
	return cloned;
}

test("隣接する三つの日本語本文段落から二つの境界を生成する", () => {
	const text =
		"段落一の本文です。\n\n段落二の本文です。\n\n段落三の本文です。\n";

	expect(proseBoundaries(text)).toEqual([
		{
			id: "L1-L3",
			before: "段落一の本文です。",
			after: "段落二の本文です。",
			decision: "",
			reason: "",
		},
		{
			id: "L3-L5",
			before: "段落二の本文です。",
			after: "段落三の本文です。",
			decision: "",
			reason: "",
		},
	]);
});

test("通常段落内の単一改行を検出する", () => {
	expect(proseLineBreaks("同じ段落の前半です\n同じ段落の後半です\n")).toEqual([
		{
			id: "L1-L2",
			kind: "prose",
			before: "同じ段落の前半です",
			after: "同じ段落の後半です",
			decision: "",
			reason: "",
		},
	]);
});

test("箇条書きの表示幅による継続行を検出する", () => {
	expect(
		proseLineBreaks("- 長い箇条書きの前半\n  表示幅で折り返した後半\n"),
	).toEqual([
		{
			id: "L1-L2",
			kind: "list-continuation",
			before: "- 長い箇条書きの前半",
			after: "  表示幅で折り返した後半",
			decision: "",
			reason: "",
		},
	]);
});

test("番号付きリストのマーカー幅に応じた継続行を検出する", () => {
	expect(
		proseLineBreaks("10. 長い箇条書きの前半\n    本文開始位置から続く後半\n"),
	).toEqual([
		{
			id: "L1-L2",
			kind: "list-continuation",
			before: "10. 長い箇条書きの前半",
			after: "    本文開始位置から続く後半",
			decision: "",
			reason: "",
		},
	]);
});

test("意味の切れ目で折り返した長い段落も確認候補に残す", () => {
	const text =
		"現在状態の読み取りは実行環境へ接続するアダプターが所有し、\nドメインはアダプターが返す契約だけへ依存する\n";
	expect(proseLineBreaks(text)).toHaveLength(1);
});

test("複数の完了条件を詰めた本文と160文字以上の箇条書きを長行候補にする", () => {
	const packedRequirements =
		"必要な情報とリンクが残り、Markdown構造が壊れていないことを差分で確認する 句点の削除や文体変更では完成本文も読み、語尾の機械変換で活用や係り受けが壊れていないことを確認する 本文または判断基準を直したら未使用名で記録を作り直し、全項目を再確認してcheckを実行する 未確認や未解決の項目、項目の削除、確認後の本文または判断基準の変更は検証失敗とする";
	const longValue = "長".repeat(160);
	const result = proseLongLines(
		`${packedRequirements}\n- ${longValue}\n\`\`\`text\n${longValue}\n\`\`\`\n`,
	);

	expect(result).toEqual([
		{
			id: "L1",
			kind: "prose",
			text: packedRequirements,
			decision: "",
			reason: "",
		},
		{
			id: "L2",
			kind: "list-item",
			text: `- ${longValue}`,
			decision: "",
			reason: "",
		},
	]);
});

test("空行・Markdown構造・コード内の改行を検出しない", () => {
	const text =
		"本文A\n\n本文B\n\n- 項目A\n- 項目B\n\n```text\nコードA\nコードB\n```\n";
	expect(proseLineBreaks(text)).toEqual([]);
});

test("フロントマター・コード・リスト・表の境界を本文境界に含めない", () => {
	const text =
		"---\n" +
		"title: サンプル\n" +
		"---\n\n" +
		"本文Aです。\n\n" +
		"- 箇条書きです。\n\n" +
		"本文Bです。\n\n" +
		"| 項目 | 値 |\n" +
		"| --- | --- |\n" +
		"| A | B |\n\n" +
		"本文Cです。\n\n" +
		"```text\n" +
		"コードです。\n" +
		"```\n\n" +
		"本文Dです。\n";

	expect(proseBoundaries(text)).toEqual([]);
});

test("強調された本文やインラインのパイプ記号で境界を隠さない", () => {
	expect(
		proseBoundaries(
			"**保存条件です。**\n\n本文で `a | b` を説明する。\n\n補足です。\n",
		),
	).toHaveLength(2);
});

test("BOMとCRLFを含む本文の段落境界を抽出する", () => {
	expect(proseBoundaries("\uFEFF本文A\r\n\r\n本文B\r\n")).toHaveLength(1);
});

test("閉じられていない先頭の区切り線をfrontmatterとして扱わない", () => {
	expect(proseBoundaries("---\n\n本文A\n\n本文B\n")).toHaveLength(1);
	expect(proseLineBreaks("---\n\n本文A\n本文B\n")).toHaveLength(1);
});

test("三点リーダーで閉じるfrontmatterとチルダのコードフェンスを除外する", () => {
	const text =
		"---\ntitle: サンプル\n...\n\n本文A\n\n~~~markdown\n## コード内の見出し\n~~~\n\n本文B\n";

	expect(proseBoundaries(text)).toEqual([]);
});

test("開きフェンスと同じ長さ以上の閉じフェンスだけを受理する", () => {
	expect(closesFence("```", { char: "`", length: 3 })).toBe(true);
	expect(closesFence("````", { char: "`", length: 3 })).toBe(true);
	expect(closesFence("   ```  ", { char: "`", length: 3 })).toBe(true);
	expect(closesFence("``", { char: "`", length: 3 })).toBe(false);
	expect(closesFence("```text", { char: "`", length: 3 })).toBe(false);
	expect(closesFence("~~~", { char: "`", length: 3 })).toBe(false);
	expect(closesFence("~~~", { char: "~", length: 3 })).toBe(true);
});

test("閉じフェンスの後を本文として検査へ戻す", () => {
	const text = "```text\nコードです。\n```\n\n本文Aです。\n\n本文Bです。\n";

	expect(markdownLines(text).map((item) => item.region)).toEqual([
		"fence-open",
		"fence",
		"fence-close",
		"body",
		"body",
		"body",
		"body",
		"body",
	]);
	expect(proseBoundaries(text)).toHaveLength(1);
});

test("開きフェンスより長い閉じフェンスの後も本文を抽出する", () => {
	const text = "```text\nコードです。\n````\n\n本文Aです。\n\n本文Bです。\n";

	expect(proseBoundaries(text)).toHaveLength(1);
});

test("閉じられていないコードフェンスの後の本文を検査しない", () => {
	const text = "```text\nコードです。\n\n本文Aです。\n\n本文Bです。\n";

	expect(markdownLines(text).every((item) => item.region !== "body")).toBe(
		true,
	);
});

test("コードフェンス内の見出しを判断基準から除外する", () => {
	const rules =
		"## 判断基準\n\n### 基準A\n\n```markdown\n### コード例\n```\n\n~~~markdown\n### 別のコード例\n~~~\n\n## 監査\n\n### 確認項目\n";
	withTemporaryFiles("本文\n", rules, (documentPath, rulesPath) => {
		const review = snapshot([documentPath], rulesPath);
		expect(review.version).toBe(1);
		expect(review.criteria).toEqual([
			{ criterion: "基準A", decision: "", evidence: "" },
		]);
	});
});

test("重複する判断基準の見出しを拒否する", () => {
	withTemporaryFiles(
		"本文\n",
		"## 判断基準\n\n### 基準A\n\n### 基準A\n",
		(documentPath, rulesPath) => {
			expect(() => snapshot([documentPath], rulesPath)).toThrow(
				"判断基準の見出しが重複しています: 基準A",
			);
		},
	);
});

test("判断基準の節が重複している基準ファイルを拒否する", () => {
	const rules =
		"## 判断基準\n\n### 基準A\n\n## 監査\n\n## 判断基準\n\n### 基準B\n";
	withTemporaryFiles("本文\n", rules, (documentPath, rulesPath) => {
		expect(() => snapshot([documentPath], rulesPath)).toThrow(
			"判断基準の節が重複しています",
		);
	});
});

test("未確認または欠落した基準・本文境界のレビューを拒否する", () => {
	withTemporaryFiles(
		"設定値を保存する条件です。\n同じ段落の補足です。\n\n障害時に復旧コマンドを実行します。\n",
		DEFAULT_RULES,
		(documentPath, rulesPath) => {
			const complete = reviewedSnapshot(documentPath, rulesPath);
			const cases: Array<[string, (review: MutableReview) => void]> = [
				["未確認の基準", (review) => (at(review.criteria, 0).decision = "")],
				[
					"未確認の境界",
					(review) => (at(at(review.documents, 0).boundaries, 0).decision = ""),
				],
				["基準エントリの欠落", (review) => (review.criteria = [])],
				[
					"境界エントリの欠落",
					(review) => (at(review.documents, 0).boundaries = []),
				],
				["根拠の欠落", (review) => delete at(review.criteria, 0).evidence],
				[
					"境界を残す理由の欠落",
					(review) => delete at(at(review.documents, 0).boundaries, 0).reason,
				],
				[
					"未解決の統合",
					(review) =>
						(at(at(review.documents, 0).boundaries, 0).decision = "merge"),
				],
				[
					"未確認の単一改行",
					(review) => (at(at(review.documents, 0).lineBreaks, 0).decision = ""),
				],
			];

			for (const [name, mutate] of cases) {
				const review = cloneReview(complete);
				mutate(review);
				expect(verify([documentPath], review, rulesPath), name).not.toEqual([]);
			}
		},
	);
});

test("未確認または欠落した長行レビューを拒否する", () => {
	const longLine = "長い本文です。".repeat(24);
	withTemporaryFiles(
		`${longLine}\n`,
		DEFAULT_RULES,
		(documentPath, rulesPath) => {
			const complete = reviewedSnapshot(documentPath, rulesPath);
			const unreviewed = cloneReview(complete);
			at(at(unreviewed.documents, 0).longLines, 0).decision = "";
			const missing = cloneReview(complete);
			at(missing.documents, 0).longLines = [];

			expect(verify([documentPath], unreviewed, rulesPath)).not.toEqual([]);
			expect(verify([documentPath], missing, rulesPath)).not.toEqual([]);
		},
	);
});

test("レビュー済み境界の文脈変更を拒否する", () => {
	withTemporaryFiles(
		"設定値を保存する条件です。\n\n障害時に復旧コマンドを実行します。\n",
		DEFAULT_RULES,
		(documentPath, rulesPath) => {
			const review = reviewedSnapshot(documentPath, rulesPath);
			at(at(review.documents, 0).boundaries, 0).before = "改変された本文です。";

			expect(
				verify([documentPath], review, rulesPath).some((error) =>
					error.includes("文脈が改変"),
				),
			).toBe(true);
		},
	);
});

test("本文の変更後は古いレビューを拒否する", () => {
	withTemporaryFiles(
		"本文です。\n",
		DEFAULT_RULES,
		(documentPath, rulesPath) => {
			const review = reviewedSnapshot(documentPath, rulesPath);
			writeFileSync(documentPath, "本文が変更されました。\n", "utf8");

			expect(
				verify([documentPath], review, rulesPath).some((error) =>
					error.includes("documentSha256"),
				),
			).toBe(true);
		},
	);
});

test("基準の変更後は古いレビューを拒否する", () => {
	withTemporaryFiles(
		"本文です。\n",
		DEFAULT_RULES,
		(documentPath, rulesPath) => {
			const review = reviewedSnapshot(documentPath, rulesPath);
			writeFileSync(rulesPath, "## 判断基準\n\n### 変更後の基準\n", "utf8");

			expect(
				verify([documentPath], review, rulesPath).some((error) =>
					error.includes("rulesSha256"),
				),
			).toBe(true);
		},
	);
});

test("境界が一つ以上ある文書と境界ゼロの文書を完全確認すると通過する", () => {
	withTemporaryFiles(
		"設定値を保存する条件です。\n\n障害時に復旧コマンドを実行します。\n",
		DEFAULT_RULES,
		(documentPath, rulesPath) => {
			const review = reviewedSnapshot(documentPath, rulesPath);
			expect(at(review.documents, 0).boundaries.length).toBeGreaterThan(0);
			expect(verify([documentPath], review, rulesPath)).toEqual([]);
		},
	);

	withTemporaryFiles(
		"一つの段落だけです。\n",
		DEFAULT_RULES,
		(documentPath, rulesPath) => {
			const review = reviewedSnapshot(documentPath, rulesPath);
			expect(at(review.documents, 0).boundaries).toEqual([]);
			expect(verify([documentPath], review, rulesPath)).toEqual([]);
		},
	);
});

test("複数文書の記録をまとめて検証する", () => {
	withTemporaryDocuments(
		["第一の文書です。\n\n第二の段落です。\n", "第三の文書です。\n"],
		DEFAULT_RULES,
		(documentPaths, rulesPath) => {
			const review = snapshot(documentPaths, rulesPath);
			for (const criterion of review.criteria) {
				criterion.decision = "checked";
				criterion.evidence = "確認した";
			}
			for (const document of review.documents) {
				for (const boundary of document.boundaries) {
					boundary.decision = "keep";
					boundary.reason = "別の判断のため";
				}
			}
			expect(review.documents).toHaveLength(2);
			expect(verify(documentPaths, review, rulesPath)).toEqual([]);
		},
	);
});

test("文書の並びや対象が変わった記録を拒否する", () => {
	withTemporaryDocuments(
		["第一の文書です。\n", "第二の文書です。\n"],
		DEFAULT_RULES,
		(documentPaths, rulesPath) => {
			const review = reviewedSnapshot(at(documentPaths, 0), rulesPath);
			review.documents = [at(review.documents, 0)];

			expect(
				verify(documentPaths, review, rulesPath).some((error) =>
					error.includes("documents の対象"),
				),
			).toBe(true);
		},
	);
});
