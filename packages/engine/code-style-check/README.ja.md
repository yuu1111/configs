[English](README.md)

# @yuu1111/code-style-check

baselineを持たない小さなsource style検査
隣接する関数定義の間隔を1つの空行へ揃える

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
src/worker.ts:8:1 blank-line-between-functions error the function definition submitRootMessage needs a single blank line before it
Checked 42 files: 1 errors, 0 warnings
```

## Rules

| Rule | 重大度 | Default | 検出対象 |
|------|----------|---------|---------|
| `blank-line-between-functions` | error | true | 隣接する関数定義の間に空行が無い |
| `blank-line-between-functions` | warning | true | 隣接する関数定義の間に空行が2行以上ある |

## 検査する定義

- `function` 宣言（`export`、`async`、generatorを含む）
- classのconstructor、method、getter、setter（privateを含む）

次は定義として扱わない

- overload signatureとabstract method（本体を持たない宣言）
- interfaceのmethod signature
- object literalのmethod
- 変数へ代入したarrow function
- 間へ別の文がある定義の組（隣接しないため対象外）

## 空行の数え方

定義の終端と次の定義の開始の間で、連続する空白だけの行がちょうど1行あることを要求する

間にあるcommentの行は空行として数えず、空行の連続を途切れさせる

## 他のlinterとの対応

- RubyのRuboCop `Layout/EmptyLineBetweenDefs` と同じく、隣接する定義の間だけを対象にする
- Pythonのpycodestyle E302とE305はすべてのトップレベル定義の前後へ空行を要求するが、このruleは隣接する定義の組に限る
- JavaのCheckstyle `EmptyLineSeparator` と同じく、class memberも定義として扱う
- 空行が多すぎる場合のwarningはpycodestyle E303とrustfmtの `blank_lines_upper_bound` を参考にする

## Options

| Option | 説明 |
|--------|-------------|
| `--ignore <path>` | 検査から外すpath 複数指定できる |
| `--json` | 検出を `errors` と `warnings` のJSONで出力する |
