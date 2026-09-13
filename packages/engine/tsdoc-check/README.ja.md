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
| `type-param-mismatch` | error | true | 宣言に無いtype parameterを指す `@typeParam` |
| `tsdoc-tag` | warning | true | TSDoc設定が定義していないtag |
| `missing-doc` | warning | true | TSDoc commentの無いexported宣言 |
| `single-line-doc` | warning | true | 1行で書いたTSDoc comment |
| `param-untagged` | warning | true | `@param` の無い宣言済みparameter |
| `type-param-untagged` | warning | true | `@typeParam` の無い宣言済みtype parameter |
| `param-order` | warning | false | 宣言順と違う `@param` の並び |
| `missing-returns` | warning | false | `@returns` の無い値を返す関数 |
| `deprecated-without-guidance` | warning | false | 代替先を示さない `@deprecated` |

TSDocが定義していないtagは `tsdoc-tag` のwarningになる `@description` などの独自tagもそこで報告し、`--error tsdoc-tag` ですべてerrorへ上げる

`param-order` と `missing-returns` と `deprecated-without-guidance` は `--enable` で指定するまで実行しない

```bash
tsdoc-check --enable missing-returns --enable param-order --enable deprecated-without-guidance src
```

`missing-returns` は明示した戻り値型だけを読み、注釈の無い関数は対象外にする `Promise<void>` は値を返さない扱いにする
`deprecated-without-guidance` は `@see` か `@deprecated` の文中の `{@link}` を代替先として受け入れる

検査対象はトップレベルのexported宣言だけ parseできないfileはTypeScript compilerとBiomeへ任せ、その宣言は検査しない

ruleの識別子は `@yuu1111/tsdoc-check/rule-ids`（`TsdocRule`、`OptInRuleId`）として公開し、`quality.config.ts` のようなTypeScriptの設定から参照できる

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
| `--enable <rule>` | opt-in ruleを有効にする、複数指定できる |
| `--error <rule>` | 指定したruleをerrorへ上げる、複数指定できる |
| `--ignore <path>` | 検査から外すpath、複数指定できる |
| `--json` | 検出をJSONで出力する |
