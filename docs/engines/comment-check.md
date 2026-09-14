# comment-check

`@yuu1111/quality-check` に同梱される comment 検査の設定とrule

## 設定例

```json
{
  "comment-check": {
    "enabled": true,
    "targets": ["src"],
    "ignore": ["generated"],
    "rules": {
      "preset": "recommended",
      "shape": {
        "cramped-comment": "on"
      },
      "content": {
        "japanese-period": "on"
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
| `broad-suppression` | `suppression` | error | true | `biome-ignore-all`、`@ts-nocheck`、ruleを書いていない `eslint-disable` |
| `undocumented-directive` | `suppression` | error | true | 説明の無い `@ts-ignore` と `@ts-expect-error` |
| `cramped-comment` | `shape` | error | false | 直前の行へ空行なしで続く複数行comment |
| `separator-comment` | `shape` | error | true | 記号だけで作った装飾comment |
| `placeholder-comment` | `content` | error | true | `TODO`、`FIXME`、`XXX`、`HACK` |
| `japanese-period` | `content` | error | false | 日本語の文を終える `。` を含むcomment |

`cramped-comment` と `japanese-period` はopt-inで、`preset` の `recommended` では無効になる

## 各ruleの意図

- `cramped-comment` は複数行のblock commentの直前へ空行を要求し、直前のコードとの境目を作る
- `japanese-period` はcomment内の日本語の文を `。` で終わらせない
- `separator-comment` と `placeholder-comment` は、意味を足さないcommentと後で解消するはずのcommentを区別する

baselineの差分判定は `@yuu1111/quality-check` が持つため、このengineは見つけた検出をすべて報告する
