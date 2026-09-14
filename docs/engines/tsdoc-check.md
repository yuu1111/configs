# tsdoc-check

`@yuu1111/quality-check` に同梱される TSDoc 検査の設定とrule

## 設定例

```json
{
  "tsdoc-check": {
    "enabled": true,
    "targets": ["src"],
    "ignore": ["generated"],
    "rules": {
      "preset": "recommended",
      "syntax": {
        "tsdoc-tag": "error"
      },
      "documentation": {
        "missing-returns": "on",
        "deprecated-without-guidance": "on"
      },
      "contract": {
        "param-order": "on"
      }
    }
  }
}
```

`enabled`、`targets`、`ignore`、`rules` と `preset`、group、rule の指定は [`quality-check` の設定](../../packages/engine/quality-check/README.md) にある
このengineはin-processで起動し `args` を取らない

## rule 一覧

| Rule | Group | 重大度 | Default | 検出対象 |
|------|-------|--------|---------|----------|
| `tsdoc-syntax` | `syntax` | error | true | TSDoc parserが返す構文メッセージ |
| `param-mismatch` | `contract` | error | true | signatureが宣言していないparameterを指す `@param` |
| `type-param-mismatch` | `contract` | error | true | 宣言に無いtype parameterを指す `@typeParam` |
| `suppression` | `suppression` | error | true | 理由の無い抑制、未知のrule、ruleを書いていない抑制 |
| `tsdoc-tag` | `syntax` | warning | true | TSDoc設定が定義していないtag |
| `missing-doc` | `documentation` | warning | true | TSDoc commentの無いexported宣言 |
| `single-line-doc` | `syntax` | warning | true | 1行で書いたTSDoc comment |
| `blank-line-before-tags` | `syntax` | warning | true | summaryの直下に書いたblock tag |
| `param-untagged` | `contract` | warning | true | `@param` の無い宣言済みparameter |
| `type-param-untagged` | `contract` | warning | true | `@typeParam` の無い宣言済みtype parameter |
| `suppression-unused` | `suppression` | warning | true | 何も抑制しない抑制 |
| `param-order` | `contract` | warning | false | 宣言順と違う `@param` の並び |
| `missing-returns` | `documentation` | warning | false | `@returns` の無い値を返す関数 |
| `deprecated-without-guidance` | `documentation` | warning | false | 代替先を示さない `@deprecated` |

`param-order`、`missing-returns`、`deprecated-without-guidance` はopt-inで、`rules` が `on` にするまで実行しない

`error` を取れるのは `tsdoc-check` だけで、そのruleを違反へ上げ opt-inのruleは先に有効にする

## tagと構文

`blank-line-before-tags` はsummaryと最初のblock tagの間に空の `*` 行を要求し、tagの並びを説明の1行下から始めさせる
空行より下のtagは続けて並べ、summaryを持たずtagで始まるcommentは対象外にする

TSDocが定義していないtagは `tsdoc-tag` のwarningになる
`@description` などの独自tagもそこで報告し、`syntax` groupの `tsdoc-tag` を `error` にするとすべてerrorへ上がる

## 判断の範囲

`missing-returns` は明示した戻り値型だけを読み、注釈の無い関数は対象外にする
`Promise<void>` は値を返さない扱いにする

`deprecated-without-guidance` は `@see` か `@deprecated` の文中の `{@link}` を代替先として受け入れる

検査対象はトップレベルのexported宣言だけである
parseできないfileはTypeScript compilerとBiomeへ任せ、その宣言は検査しない

## 抑制

例外は宣言の隣に理由を添えて示す

```ts
// tsdoc-check-ignore missing-doc: the loader reads this value
export const value = 1
```

理由の無い抑制、未知のrule、ruleを書いていない抑制は `suppression` のerrorになる
何も抑制しない抑制は `suppression-unused` のwarningになる
