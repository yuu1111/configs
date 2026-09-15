# code-style-check

`@yuu1111/quality-check` に同梱される TypeScript と JavaScript の source style 検査の設定とrule

## 設定例

```json
{
  "code-style-check": {
    "enabled": true,
    "includes": ["src/**", "!src/generated/**"],
    "rules": {
      "preset": "recommended",
      "spacing": "on"
    }
  }
}
```

`enabled`、`includes`、`rules` と `preset`、group、rule の指定は [`quality-check` の設定](../../packages/engine/quality-check/README.ja.md) にある
このengineはin-processで起動し `args` を取らない

## rule 一覧

| Rule | Group | 重大度 | Default | 検出対象 |
|------|-------|--------|---------|----------|
| `blank-line-between-class-members` | `spacing` | error / warning | true | class propertyと隣のmemberの間に空行が無い、または空行が2行以上ある |
| `blank-line-between-definitions` | `spacing` | error / warning | true | 隣接する定義の間に空行が無い、または空行が2行以上ある |

opt-inのruleは無く、`preset` の `recommended` で両ruleが有効になる
同じruleが空行の不足をerror、過剰をwarningとして報告する

## 定義として扱う宣言

- `function` 宣言（`export`、`async`、generatorを含む）
- `class` 宣言
- `type`、`interface`、`enum`、`namespace` の宣言
- `const`、`let`、`var` の変数宣言
- classのconstructor、method、getter、setter（privateを含む）
- classのproperty（`#name`、`accessor`、`declare`、`abstract`を含む）

次のものは定義として扱わない

- overload signatureとabstract method（本体を持たない宣言）
- interfaceのmethod signature
- object literalのmethod
- classのstatic block
- import、再exportをはじめ、宣言以外の文
- 間に別の文がある定義の組（隣接しないため対象外）

変数宣言と変数宣言の組、class property同士の組には空行を要求しないため、まとめて書ける

## 空行の数え方

定義の終端と次の定義の開始の間へ、空白だけの行がちょうど1行あることを要求する

間にあるcommentの行は空行として数えず、空行の連続を途切れさせる
そのため空行はcommentの上と下のどちらに置いてもよい
