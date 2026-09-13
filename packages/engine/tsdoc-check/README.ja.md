[English](README.md)

# @yuu1111/tsdoc-check

exported宣言のための共有TSDoc checker

このengineはprivateなworkspace packageとして `@yuu1111/quality-check` へ同梱し、`quality.json` の `tsdoc-check` sectionで有効にする

## Usage

`tsdoc-check` sectionでengineを有効にしてruleを選ぶ

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

`error` を取れるのは `tsdoc-check` だけで、そのruleを違反へ上げ opt-inのruleは先に有効にする
`preset` だけでは `param-order`、`missing-returns`、`deprecated-without-guidance` が無効のままなので `on` が要る

## Config

| Condition | 説明 |
|-----------|-------------|
| `enabled` | engineを起動する 省略または `false` のsectionは起動しない |
| `targets` | 検査するpath 省略時はカレントdirectoryを検査する |
| `ignore` | 検査から外すpath |
| `rules` | `preset`、group、ruleの3段のrule選択 具体的な指定が勝つ |

`preset` は `recommended` でengineの既定、`all` で全rule有効、`none` で全rule無効にする
group名のkeyはengineが公開するgroupで、そのgroup全体へ `off`、`on`、`error` を渡し、group名の下のobjectはruleを1つずつ選ぶ
`error` を取れるのはここだけで、`tsdoc-check` が唯一ruleを違反へ上げるengineだからである
このengineはin-processで走るため `args` の条件を取らない

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

TSDocが定義していないtagは `tsdoc-tag` のwarningになる `@description` などの独自tagもそこで報告し、`syntax` groupの `tsdoc-tag` を `error` にするとすべてerrorへ上がる

`param-order` と `missing-returns` と `deprecated-without-guidance` は `rules` が `on` にするまで実行しない 例はUsageにある
`missing-returns` は明示した戻り値型だけを読み、注釈の無い関数は対象外にする `Promise<void>` は値を返さない扱いにする
`deprecated-without-guidance` は `@see` か `@deprecated` の文中の `{@link}` を代替先として受け入れる

検査対象はトップレベルのexported宣言だけ parseできないfileはTypeScript compilerとBiomeへ任せ、その宣言は検査しない

このengineはrule語彙を `./rule-ids` subpath（`KNOWN_RULE_NAMES`、`OPT_IN_RULE_IDS`、`RULE_GROUPS`）として公開し、その語彙を `quality.json` の `$schema` がこのsectionのために読む

## Suppressions

例外は宣言の隣に理由を添えて示す

```ts
// tsdoc-check-ignore missing-doc: the loader reads this value
export const value = 1
```

理由の無い抑制、未知のrule、ruleを書いていない抑制はerror
何も抑制しない抑制はwarning
