[English](README.md)

# @yuu1111/document-style-check

判断記録を持つ小さなMarkdown検査で、機械的に意味のない違反を文書から除き、残りへ書かれた判断を要求する

## Install

```bash
bun add -D @yuu1111/document-style-check
```

## Usage

意味を持たない違反を報告または整形する

```bash
document-style-check lint .
document-style-check lint --write .
```

```text
AGENTS.md:18:1 hard-break-html error an HTML hard break adds spacing without meaning
Checked 14 files: 1 errors, 0 warnings
```

日本語の文末の `。` や半角カンマ、全角英数字も止めるProjectはopt-inのruleを指定する

```bash
document-style-check lint --enable japanese-period --enable japanese-comma --enable full-width-alphanumeric .
```

判断が要る候補を記録し、埋めてから確認する

```bash
document-style-check scan doc.md --rules SKILL.md --review review.json
document-style-check check doc.md --rules SKILL.md --review review.json
```

記録は本文と基準のhashを固定するため、どちらかを編集すると無効になる `check`が保証するのは全項目に判断と根拠があることだけで、文体判断の正しさは別に確認する

## Rules

| Rule | 重大度 | Default | 検出対象 |
|------|----------|---------|---------|
| `code-fence-language` | error | true | 言語指定の無いコードフェンス |
| `consecutive-blank-lines` | error | true | 意味を持たない連続空行 |
| `date-anchored-statement` | warning | true | 対象の識別を確認日で代用した記述 |
| `empty-link` | error | true | ラベルまたはリンク先が空のリンク |
| `full-width-alphanumeric` | error | false | `Ａ` や `１` のような全角英数字 |
| `hard-break-html` | error | true | 本文中の `<br>` |
| `heading-level-jump` | warning | true | 一段を超えて飛んだ見出し |
| `japanese-comma` | error | false | 日本語に隣接する半角カンマ |
| `japanese-period` | error | false | 日本語の文を終える `。` |
| `list-marker-consistency` | error | false | 最初の記号と違う箇条書き記号 |
| `trailing-backslash` | error | true | 本文行の末尾のバックスラッシュ |
| `trailing-whitespace` | error | true | 行末の空白 |

`consecutive-blank-lines`、`hard-break-html`、`trailing-backslash`、`trailing-whitespace`は整形できるため`lint --write`で解消する `list-marker-consistency`も整形できるが、有効にしたときだけ最初に見つけた記号へ揃える `code-fence-language`、`empty-link`、`full-width-alphanumeric`、`japanese-comma`、`japanese-period`は`--write`の後にもerrorとして残る `date-anchored-statement`と`heading-level-jump`は人またはモデルが判断するwarningになる

## Commands

| Command | 説明 |
|---------|-------------|
| `scan` | 対象文書の未確認の検証記録を書き出す |
| `check` | 埋めた検証記録を現在の本文と基準に対して確認する |
| `lint` | 機械的な違反を報告し、`--write`で整形する |

## Options

| Option | 説明 |
|--------|-------------|
| `--rules <path>` | `## 判断基準`を持つ基準fileで、`scan`と`check`では必須 |
| `--review <path>` | 読み書きする検証記録file |
| `--enable <rule>` | opt-in ruleを実行する、複数指定できる、未知の名前は設定error |
| `--ignore <path>` | 検査から外すpath、複数指定できる |
| `--write` | 報告の代わりに整形を適用する |
| `--json` | 検出をJSONで出力する |
