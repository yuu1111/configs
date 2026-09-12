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

## Rules

| Rule | 検出対象 |
|------|---------|
| `broad-suppression` | `biome-ignore-all`、`@ts-nocheck`、ruleを書いていない `eslint-disable` |
| `undocumented-directive` | 説明の無い `@ts-ignore` と `@ts-expect-error` |
| `placeholder-comment` | `TODO`、`FIXME`、`XXX`、`HACK` |
| `separator-comment` | 記号だけで作った装飾comment |

## Options

| Option | Description |
|--------|-------------|
| `--baseline <path>` | 読み書きするbaseline file（既定は `comment-baseline.json`） |
| `--ignore <path>` | 検査から外すpath 複数指定できる |
| `--update-baseline` | baselineを現在の検出で置き換える |
| `--json` | 新規と解消済みの検出をJSONで出力する |

## Notes

生成物のディレクトリなどProjectが持つpathは `--ignore` で検査から外す 例えば `--ignore src/generated`

baselineはrule、file、comment本文をキーにするため、行が動いてもそのcommentを新規とは報告しない Biomeは `biome-ignore` の理由と未使用の抑制を既に扱うため、このcheckerはBiomeが読まないcommentの細部だけを担当する
