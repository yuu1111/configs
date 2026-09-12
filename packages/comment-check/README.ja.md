[English](README.md)

# @yuu1111/comment-check

baselineを持つ小さなcomment検査 抑制commentとplaceholder commentの増殖を止める

## Install

```bash
bun add -D @yuu1111/comment-check
```

## Usage

現在の検出を一度baselineへ記録し、新しく出たものだけを失敗にする

```bash
comment-check --update-baseline .
comment-check .
```

```
src/queue.ts:18:2 undocumented-directive TypeScript directive needs a description
Checked 42 files: 1 new, 0 resolved, 3 baselined
```

日本語の文末の `。` も止めるProjectはopt-inのruleを指定する

```bash
comment-check --enable japanese-period .
```

## Rules

| Rule | 検出対象 |
|------|---------|
| `broad-suppression` | `biome-ignore-all`、`@ts-nocheck`、ruleを書いていない `eslint-disable` |
| `undocumented-directive` | 説明の無い `@ts-ignore` と `@ts-expect-error` |
| `placeholder-comment` | `TODO`、`FIXME`、`XXX`、`HACK` |
| `separator-comment` | 記号だけで作った装飾comment |
| `japanese-period` | 日本語の文を終える `。` を含むcomment（opt-in） |

## Options

| Option | Description |
|--------|-------------|
| `--baseline <path>` | 読み書きするbaseline file（既定は `comment-baseline.json`） |
| `--enable <rule>` | opt-in ruleを実行する 複数指定できる 未知の名前は設定error |
| `--ignore <path>` | 検査から外すpath 複数指定できる |
| `--update-baseline` | baselineを現在の検出で置き換える |
| `--json` | 新規と解消済みの検出をJSONで出力する |

## Notes

生成物のディレクトリなどProjectが持つpathは `--ignore` で検査から外す 例えば `--ignore src/generated`

baselineはrule、file、comment本文をキーにするため、行が動いてもそのcommentを新規とは報告しない Biomeは `biome-ignore` の理由と未使用の抑制を既に扱うため、このcheckerはBiomeが読まないcommentの細部だけを担当する

`japanese-period` は `--enable` で指定するまで動かないため、既存Projectの検出結果は変わらない 最初の `。` の位置を行と桁で報告し、句点が複数あっても1 commentにつき1件にまとめ、comment本文は書き換えない
