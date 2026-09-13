[English](README.md)

# @yuu1111/comment-check

抑制commentとplaceholder commentの増殖を止める小さなcomment検査

## Install

```bash
bun add -D @yuu1111/comment-check
```

## Usage

```bash
comment-check .
comment-check --ignore generated src
```

```text
src/queue.ts:18:2 undocumented-directive error TypeScript directive needs a description
Checked 42 files: 1 errors, 0 warnings
```

baselineの差分判定は `@yuu1111/quality-check` が持つため、このCLIは見つけた検出をすべて報告する

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

ruleの識別子は `@yuu1111/comment-check/rule-ids`（`RuleId`、`OptInRuleId`）として公開し、`quality.json` の `$schema` が読むrule語彙の出所になる

既定で有効なruleも `--disable` で無効にできる

## Options

| Option | 説明 |
|--------|-------------|
| `--enable <rule>` | opt-in ruleを実行する、複数指定できる、未知の名前は設定error |
| `--disable <rule>` | ruleを無効にする、複数指定できる、未知の名前は設定error、`--enable`と同じruleは指定できない |
| `--ignore <path>` | 検査から外すpath、複数指定できる |
| `--json` | 検出を `errors` と `warnings` として出力する |
