[English](README.md)

# @yuu1111/comment-check

抑制commentとplaceholder commentの増殖を止める小さなcomment検査

このengineはprivateなworkspace packageとして `@yuu1111/quality-check` へ同梱し、`quality.json` の `comment-check` sectionで有効にする

## Usage

`comment-check` sectionでengineを有効にしてruleを選ぶ

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

`cramped-comment` と `japanese-period` はopt-inのruleで、`preset` だけでは無効のままになる
`cramped-comment` は複数行のblock commentの直前へ空行を要求し、`japanese-period` はcomment内の日本語の文を `。` で終わらせない
既定で有効なruleは `rules` の `off` で無効にできる

baselineの差分判定は `@yuu1111/quality-check` が持つため、このengineは見つけた検出をすべて報告する

## Config

| Condition | 説明 |
|-----------|-------------|
| `enabled` | engineを起動する 省略または `false` のsectionは起動しない |
| `targets` | 検査するpath 省略時はカレントdirectoryを検査する |
| `ignore` | 検査から外すpath |
| `rules` | `preset`、group、ruleの3段のrule選択 具体的な指定が勝つ |

`preset` は `recommended` でengineの既定、`all` で全rule有効、`none` で全rule無効にする
group名のkeyはengineが公開するgroupで、そのgroup全体へ `off` と `on` を渡し、group名の下のobjectはruleを1つずつ選ぶ
このengineはin-processで走るため `args` の条件を取らない

## Rules

| Rule | 重大度 | Default | 検出対象 |
|------|----------|---------|---------|
| `broad-suppression` | error | true | `biome-ignore-all`、`@ts-nocheck`、ruleを書いていない `eslint-disable` |
| `cramped-comment` | error | false | 直前の行へ空行なしで続く複数行comment |
| `undocumented-directive` | error | true | 説明の無い `@ts-ignore` と `@ts-expect-error` |
| `placeholder-comment` | error | true | `TODO`、`FIXME`、`XXX`、`HACK` |
| `separator-comment` | error | true | 記号だけで作った装飾comment |
| `japanese-period` | error | false | 日本語の文を終える `。` を含むcomment |

`suppression`、`shape`、`content` groupがこれらのruleを持つ
このengineはrule語彙を `./rule-ids` subpath（`RULE_IDS`、`OPT_IN_RULE_IDS`、`RULE_GROUPS`）として公開し、その語彙を `quality.json` の `$schema` がこのsectionのために読む
