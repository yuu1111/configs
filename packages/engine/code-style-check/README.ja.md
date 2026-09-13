[English](README.md)

# @yuu1111/code-style-check

TypeScriptとJavaScriptのsource style検査

## Usage

`code-style-check` sectionでengineを有効にしてruleを選ぶ

```json
{
  "code-style-check": {
    "enabled": true,
    "targets": ["src"],
    "ignore": ["generated"],
    "rules": {
      "preset": "recommended",
      "spacing": "on"
    }
  }
}
```

`spacing` が唯一のrule groupで、このengineが報告する全ruleをまとめる
既定で有効なruleは `rules` の `off` で無効にできる

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
| `blank-line-between-class-members` | error | true | class propertyと隣のmemberの間に空行が無い |
| `blank-line-between-class-members` | warning | true | class propertyと隣のmemberの間に空行が2行以上ある |
| `blank-line-between-definitions` | error | true | 隣接する定義の間に空行が無い |
| `blank-line-between-definitions` | warning | true | 隣接する定義の間に空行が2行以上ある |

`spacing` groupが両ruleを持つ
このengineはrule語彙を `./rule-ids` subpath（`RULE_IDS`、`OPT_IN_RULE_IDS`、`RULE_GROUPS`）として公開し、その語彙を `quality.json` の `$schema` がこのsectionのために読む

## Definitions that are checked

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

## How the blank line is counted

定義の終端と次の定義の開始の間で、連続する空白だけの行がちょうど1行あることを要求する

間にあるcommentの行は空行として数えず、空行の連続を途切れさせる
