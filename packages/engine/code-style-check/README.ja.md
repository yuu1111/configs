[English](README.md)

# @yuu1111/code-style-check

baselineを持たない小さなsource style検査
隣接する定義の間隔を1つの空行へ揃える

## Install

```bash
bun add -D @yuu1111/code-style-check
```

## Usage

```bash
code-style-check .
code-style-check --ignore generated src
```

```text
src/worker.ts:8:1 blank-line-between-definitions error the function definition submitRootMessage needs a single blank line before it
Checked 42 files: 1 errors, 0 warnings
```

## Rules

| Rule | 重大度 | Default | 検出対象 |
|------|----------|---------|---------|
| `blank-line-between-class-members` | error | true | class propertyと隣のmemberの間に空行が無い |
| `blank-line-between-class-members` | warning | true | class propertyと隣のmemberの間に空行が2行以上ある |
| `blank-line-between-definitions` | error | true | 隣接する定義の間に空行が無い |
| `blank-line-between-definitions` | warning | true | 隣接する定義の間に空行が2行以上ある |

ruleの識別子は `@yuu1111/code-style-check/rule-ids`（`RuleId`）として公開し、`quality.json` の `$schema` が読むrule語彙の出所になる

既定で有効なruleも `--disable` で無効にできる

## 検査する定義

- `function` 宣言（`export`、`async`、generatorを含む）
- `class` 宣言
- `type`、`interface`、`enum`、`namespace` の宣言
- `const`、`let`、`var` の変数宣言
- classのconstructor、method、getter、setter（privateを含む）
- classのproperty（`#name`、`accessor`、`declare`、`abstract`を含む）

次は定義として扱わない

- overload signatureとabstract method（本体を持たない宣言）
- interfaceのmethod signature
- object literalのmethod
- classのstatic block
- import、再exportをはじめ、宣言以外の文
- 間へ別の文がある定義の組（隣接しないため対象外）

変数宣言と変数宣言の組、class property同士の組には空行を要求しないため、まとめて書ける

## 空行の数え方

定義の終端と次の定義の開始の間で、連続する空白だけの行がちょうど1行あることを要求する

間にあるcommentの行は空行として数えず、空行の連続を途切れさせる

## Options

| Option | 説明 |
|--------|-------------|
| `--disable <rule>` | ruleを無効にする、複数指定できる、未知の名前は設定error |
| `--ignore <path>` | 検査から外すpath、複数指定できる |
| `--json` | 検出を `errors` と `warnings` のJSONで出力する |
