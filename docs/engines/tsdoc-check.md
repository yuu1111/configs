# tsdoc-check

`@yuu1111/quality-check` に同梱される TSDoc 検査の設定とrule

## 設定例

```json
{
  "tsdoc-check": {
    "enabled": true,
    "includes": ["src/**", "!src/generated/**"],
    "docScope": "exported",
    "styleScope": "documented",
    "rules": {
      "preset": "recommended",
      "syntax": {
        "blank-line-before-tags": "on",
        "single-line-doc": "on",
        "tsdoc-tag": "error"
      },
      "documentation": {
        "deprecated-without-guidance": "on",
        "missing-doc": "on",
        "missing-returns": "on"
      },
      "contract": {
        "param-order": "on",
        "param-untagged": "on",
        "type-param-untagged": "on"
      }
    }
  }
}
```

`enabled`、`includes`、`rules` と `preset`、group、rule の指定は [`quality-check` の設定](../../packages/engine/quality-check/README.ja.md) にある
このengineはin-processで起動し `args` を取らない

## 検査する範囲

書き足りないdocを咎める範囲を `docScope` が、書いたTSDocの体裁を検査する範囲を `styleScope` が選ぶ
どちらも省略すると `exported` になる
どちらのscopeもopt-inのruleだけに効くため、`preset` の `recommended` では指定しても何も変わらない

### docScope

| `docScope` | docを要求する宣言 | 書き足りない分を検査する宣言 |
|------------|-------------------|------------------------------|
| `exported` | 公開surfaceの宣言 | docがある公開surfaceの宣言 |
| `documented` | 公開surfaceの宣言 | docがある宣言すべて |
| `all` | 関数本体の外にある宣言すべて | docがある宣言すべて |

### styleScope

| `styleScope` | 体裁を検査する宣言 |
|--------------|-------------------|
| `exported` | docがある公開surfaceの宣言 |
| `documented` | docがある宣言すべて |

公開surfaceはトップレベルの宣言のうち、`export` を付けたもの、`export { name }` が名前を挙げたもの、`export default name` と `export = name` が指すものにする
`export { name } from "..."` と `export * from "..."` は指す先の宣言がこのfileに無いため対象外にする
`all` も関数本体の中の宣言へ doc は要求しない

書かれたTSDocが正しいかだけを見るruleはどちらのscopeにも従わず、docがある宣言すべてを対象にする
その宣言にはトップレベルの宣言だけでなく、class、interface、type literal、namespace、enum、object literal のメンバーと、doc を付けた関数本体の中の宣言も含む
object literal のメンバーは変数の初期化式から辿り、引数、配列、as const のような式を包む構文の内側にあるものも対象にする
どのruleがどのscopeに従うかは rule 一覧の `対象範囲` 列にある
`orphan-doc` は宣言に付かなかったTSDoc commentを報告するため、宣言を選ぶscopeに従わない

## rule 一覧

| Rule | Group | 重大度 | Default | 対象範囲 | 検出対象 |
|------|-------|--------|---------|----------|----------|
| `tsdoc-syntax` | `syntax` | error | true | 全文書 | TSDoc parserが返す構文メッセージ |
| `param-mismatch` | `contract` | error | true | 全文書 | signatureが宣言していないparameterを指す `@param` |
| `type-param-mismatch` | `contract` | error | true | 全文書 | 宣言に無いtype parameterを指す `@typeParam` |
| `suppression` | `suppression` | error | true | 全文書 | 理由の無い抑制、未知のrule、ruleを書いていない抑制 |
| `tsdoc-tag` | `syntax` | warning | true | 全文書 | TSDoc設定が定義していないtag |
| `suppression-unused` | `suppression` | warning | true | 全文書 | 何も抑制しない抑制 |
| `missing-doc` | `documentation` | warning | false | docScope | TSDoc commentの無い宣言 |
| `single-line-doc` | `syntax` | warning | false | styleScope | 1行で書いたTSDoc comment |
| `blank-line-before-tags` | `syntax` | warning | false | styleScope | summaryの直下に書いたblock tag |
| `orphan-doc` | `syntax` | warning | true | 全文書 | どの宣言にも付いていないTSDoc comment |
| `param-untagged` | `contract` | warning | false | docScope | `@param` の無い宣言済みparameter |
| `type-param-untagged` | `contract` | warning | false | docScope | `@typeParam` の無い宣言済みtype parameter |
| `param-order` | `contract` | warning | false | docScope | 宣言順と違う `@param` の並び |
| `missing-returns` | `documentation` | warning | false | docScope | `@returns` の無い値を返す関数 |
| `deprecated-without-guidance` | `documentation` | warning | false | docScope | 代替先を示さない `@deprecated` |

`documentation` groupのruleと、`syntax` の `blank-line-before-tags`・`single-line-doc`、`contract` の `param-order`・`param-untagged`・`type-param-untagged` はopt-inで、`rules` が `on` にするまで実行しない
そのため `preset` の `recommended` は書かれたTSDocの構文と契約の整合だけを検査し、docの有無と体裁を要求しない

`warn` と `error` はruleの重大度を変更し、opt-inのruleは先に有効にする

## tagと構文

`blank-line-before-tags` はsummaryと最初のblock tagの間に空の `*` 行を要求し、tagの並びを説明の1行下から始めさせる
空行より下のtagは続けて並べ、summaryを持たずtagで始まるcommentは対象外にする

TSDocが定義していないtagは `tsdoc-tag` のwarningになる
`@description` などの独自tagもそこで報告し、`syntax` groupの `tsdoc-tag` を `error` にするとすべてerrorへ上がる

## 判断の範囲

`missing-returns` は明示した戻り値型だけを読み、注釈の無い関数は対象外にする
`Promise<void>` は値を返さない扱いにする

`deprecated-without-guidance` は `@see` か `@deprecated` の文中の `{@link}` を代替先として受け入れる

`orphan-doc` はTSDocとして書いたblock commentのうち、どの宣言の文書にもならなかったものを報告する
TSDocを積み上げたときの最後以外、宣言の無い場所へ書いたTSDoc、file末尾に残ったTSDocがここに入る

parseできないfileはTypeScript compilerとBiomeへ任せ、その宣言は検査しない

## 抑制

例外は宣言の隣に理由を添えて示す

```ts
// tsdoc-check-ignore missing-doc: the loader reads this value
export const value = 1
```

理由の無い抑制、未知のrule、ruleを書いていない抑制は `suppression` のerrorになる
何も抑制しない抑制は `suppression-unused` のwarningになる
`orphan-doc` は付ける先の宣言が無いTSDocへの指摘なので、宣言の隣に抑制を書いても効かない
