[English](README.md)

# @yuu1111/tsdoc-check

exported宣言のための共有TSDoc checker

## Install

```bash
bun add -D @yuu1111/tsdoc-check
```

## Usage

```bash
tsdoc-check src
```

## Rules

| Rule | 重大度 | Default | 検出対象 |
|------|----------|---------|---------|
| `tsdoc-syntax` | error | true | TSDoc parserが返す構文メッセージ |
| `param-mismatch` | error | true | signatureが宣言していないparameterを指す `@param` |
| `tsdoc-tag` | warning | true | TSDoc設定が定義していないtag |
| `type-param-mismatch` | error | true | 宣言に無いtype parameterを指す `@typeParam` |
| `missing-doc` | warning | true | TSDoc commentの無いexported宣言 |
| `single-line-doc` | warning | true | 1行で書いたTSDoc comment |

TSDocが定義していないtagは `tsdoc-tag` のwarningになる `@description` などの独自tagもそこで報告し、`--error tsdoc-tag` ですべてerrorへ上げる

検査対象はトップレベルのexported宣言だけ parseできないfileはTypeScript compilerとBiomeへ任せ、その宣言は検査しない

## Suppressions

例外は宣言の隣に理由を添えて示す

```ts
// tsdoc-check-ignore missing-doc: the loader reads this value
export const value = 1
```

理由の無い抑制、未知のrule、ruleを書いていない抑制はerror
何も抑制しない抑制はwarning

## Options

| Option | 説明 |
|--------|-------------|
| `--error <rule>` | 指定したruleをerrorへ上げる、複数指定できる |
| `--ignore <path>` | 検査から外すpath、複数指定できる |
| `--json` | 検出をJSONで出力する |
