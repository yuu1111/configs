[English](README.md)

# @yuu1111/document-style-check

判断記録を持つ小さなMarkdown検査 機械的に意味のない違反を文書から除き、残りへ書かれた判断を要求する

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

```
AGENTS.md:18:1 hard-break-html error an HTML hard break adds spacing without meaning
Checked 14 files: 1 errors, 0 warnings
```

日本語の文末の `。` も止めるProjectはopt-inのruleを指定する

```bash
document-style-check lint --enable japanese-period .
```

判断が要る候補を記録し、埋めてから確認する

```bash
document-style-check scan doc.md --rules SKILL.md --review review.json
document-style-check check doc.md --rules SKILL.md --review review.json
```

記録は本文と基準のhashを固定するため、どちらかを編集すると無効になる `check`が保証するのは全項目に判断と根拠があることだけで、文体判断の正しさは別に確認する

## Commands

| Command | Description |
|---------|-------------|
| `scan` | 対象文書の未確認の検証記録を書き出す |
| `check` | 埋めた検証記録を現在の本文と基準に対して確認する |
| `lint` | 機械的な違反を報告し、`--write`で整形する |

## Rules

| Rule | 検出対象 |
|------|---------|
| `consecutive-blank-lines` | 意味を持たない連続空行 |
| `date-anchored-statement` | 対象の識別を確認日で代用した記述 |
| `hard-break-html` | 本文中の `<br>` |
| `japanese-period` | 日本語の文を終える `。`（opt-in） |
| `trailing-backslash` | 本文行の末尾のバックスラッシュ |
| `trailing-whitespace` | 行末の空白 |

`consecutive-blank-lines`、`hard-break-html`、`trailing-backslash`、`trailing-whitespace`は整形できるため`lint --write`で解消する `date-anchored-statement`は人またはモデルが判断するwarningで、`japanese-period`は`--write`の後にもerrorとして残る

## Options

| Option | Description |
|--------|-------------|
| `--rules <path>` | `## 判断基準`を持つ基準file `scan`と`check`では必須 |
| `--review <path>` | 読み書きする検証記録file |
| `--enable <rule>` | opt-in ruleを実行する 複数指定できる 未知の名前は設定error |
| `--ignore <path>` | 検査から外すpath 複数指定できる |
| `--write` | 報告の代わりに整形を適用する |
| `--json` | 検出をJSONで出力する |

## Notes

opt-in ruleは `--enable` で指定するまで動かない `lint --write` の後にも `japanese-period` がerrorとして残るのは、`。` を外すと前後の文の書き換えが要るためで、このruleは報告だけを行う

`scan`は既存の検証記録を上書きしない 古い記録を信じず、新しい名前で作り直す

基準fileは`## 判断基準`の節に判断項目を見出しで並べたMarkdown
パッケージは基準を同梱しない document-styleの`SKILL.md`がその一例で、同じ形のfileなら別の基準でもよい
