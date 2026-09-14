# document-style-check

`@yuu1111/quality-check` に同梱される Markdown 検査の設定とrule
機械的に決まる違反と、人またはモデルが判断する警告を分けて持つ

## 設定例

```json
{
  "document-style-check": {
    "enabled": true,
    "targets": ["docs"],
    "ignore": ["CHANGELOG.md"],
    "rules": {
      "preset": "recommended",
      "typography": {
        "japanese-period": "on"
      },
      "structure": {
        "list-marker-consistency": "on"
      }
    }
  }
}
```

`enabled`、`targets`、`ignore`、`rules` と `preset`、group、rule の指定は [`quality-check` の設定](../../packages/engine/quality-check/README.ja.md) にある
このengineはin-processで起動し `args` を取らない

## rule 一覧

| Rule | Group | 重大度 | Default | 検出対象 |
|------|-------|--------|---------|----------|
| `code-fence-language` | `structure` | error | true | 言語指定の無いコードフェンス |
| `consecutive-blank-lines` | `whitespace` | error | true | 意味を持たない連続空行 |
| `date-anchored-statement` | `content` | warning | true | 対象の識別を確認日で代用した記述 |
| `empty-link` | `content` | error | true | ラベルまたはリンク先が空のリンク |
| `full-width-alphanumeric` | `typography` | error | false | `Ａ` や `１` のような全角英数字 |
| `hard-break-html` | `whitespace` | error | true | 本文中の `<br>` |
| `heading-level-jump` | `structure` | warning | true | 一段を超えて飛んだ見出し |
| `japanese-comma` | `typography` | error | false | 日本語に隣接する半角カンマ |
| `japanese-period` | `typography` | error | false | 日本語の文を終える `。` |
| `list-marker-consistency` | `structure` | error | false | 最初の記号と違う箇条書き記号 |
| `trailing-backslash` | `whitespace` | error | true | 本文行の末尾のバックスラッシュ |
| `trailing-whitespace` | `whitespace` | error | true | 行末の空白 |

`whitespace`、`typography`、`structure`、`content` の4 groupがこれらのruleを持つ

## 整形できるrule

`consecutive-blank-lines`、`hard-break-html`、`trailing-backslash`、`trailing-whitespace` は整形できるため `quality-check document-style lint --write` で解消する

`list-marker-consistency` も整形できるが、有効にしたときだけ最初に見つけた記号へ揃える

次のruleは `--write` の後にもerrorとして残り、本文の判断が要る

- `code-fence-language`
- `empty-link`
- `full-width-alphanumeric`
- `japanese-comma`
- `japanese-period`

## 判断を要求するwarning

`date-anchored-statement` は対象を確認日で識別した記述を報告する
日付そのものが判断に必要な期限や発生日は対象にならない

`heading-level-jump` は見出しの階層が一段を超えて飛んだ箇所を報告する
節を分けるほどの内容でない場合だけ、見出しの階層を下げずに残す
