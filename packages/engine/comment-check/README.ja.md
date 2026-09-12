[English](README.md)

# @yuu1111/comment-check

baselineを持つ小さなcomment検査で、抑制commentとplaceholder commentの増殖を止める

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

```text
src/queue.ts:18:2 undocumented-directive TypeScript directive needs a description
Checked 42 files: 1 new, 0 resolved, 3 baselined
```

日本語の文末の `。` も止めるProjectはopt-inのruleを指定する

```bash
comment-check --enable japanese-period .
```

複数行のcommentを直前の行へ続けず空行で区切るProjectは、もう一つのopt-inのruleを指定する

```bash
comment-check --enable cramped-comment .
```

## Rules

| Rule | 重大度 | Default | 検出対象 |
|------|----------|---------|---------|
| `broad-suppression` | error | true | `biome-ignore-all`、`@ts-nocheck`、ruleを書いていない `eslint-disable` |
| `cramped-comment` | error | false | 直前の行へ空行なしで続く複数行comment |
| `undocumented-directive` | error | true | 説明の無い `@ts-ignore` と `@ts-expect-error` |
| `placeholder-comment` | error | true | `TODO`、`FIXME`、`XXX`、`HACK` |
| `separator-comment` | error | true | 記号だけで作った装飾comment |
| `japanese-period` | error | false | 日本語の文を終える `。` を含むcomment |

## Options

| Option | 説明 |
|--------|-------------|
| `--baseline <path>` | 読み書きするbaseline file（既定は `comment-baseline.json`） |
| `--enable <rule>` | opt-in ruleを実行する、複数指定できる、未知の名前は設定error |
| `--ignore <path>` | 検査から外すpath、複数指定できる |
| `--update-baseline` | baselineを現在の検出で置き換える |
| `--json` | 新規と解消済みの検出をJSONで出力する |
