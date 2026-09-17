# document-style-check

`@yuu1111/quality-check` に同梱される Markdown 検査の設定とrule
機械的に決まる違反と、人またはモデルが判断する警告を分けて持つ

## 設定例

```json
{
  "document-style-check": {
    "enabled": true,
    "includes": ["docs/**", "!docs/CHANGELOG.md"],
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

`enabled`、`includes`、`rules` と `preset`、group、rule の指定は [`quality-check` の設定](../../packages/engine/quality-check/README.ja.md) にある
このengineはin-processで起動し `args` を取らない

## rule 一覧

| Rule | Group | 重大度 | Default | 検出対象 |
|------|-------|--------|---------|----------|
| `bare-url` | `content` | error | true | 角括弧で囲まれていないURL |
| `code-fence-language` | `structure` | error | true | 言語指定の無いコードフェンス |
| `code-span-padding` | `whitespace` | error | true | 前後を半角スペースで詰めたコードスパン |
| `consecutive-blank-lines` | `whitespace` | error | true | 意味を持たない連続空行 |
| `date-anchored-statement` | `content` | warning | true | 対象の識別を確認日で代用した記述 |
| `descriptive-link-text` | `content` | error | true | 行き先を説明しないリンクテキスト |
| `emphasis-as-heading` | `structure` | warning | true | 強調だけを置いた見出しの代用行 |
| `emphasis-marker` | `typography` | error | false | 最初と違う強調記号 |
| `emphasis-padding` | `whitespace` | error | true | 内側に空白のある強調記号 |
| `empty-link` | `content` | error | true | ラベルまたはリンク先が空のリンク |
| `fence-blank-lines` | `structure` | error | true | 前後が空行でないコードフェンス |
| `fence-style` | `structure` | error | false | 最初と違うコードフェンスの記号 |
| `first-line-heading` | `structure` | error | false | 先頭がトップレベル見出しでない文書 |
| `full-width-alphanumeric` | `typography` | error | false | `Ａ` や `１` のような全角英数字 |
| `hard-break-html` | `whitespace` | error | true | 本文中の `<br>` |
| `hard-tabs` | `whitespace` | error | true | 字下げや区切りのハードタブ |
| `heading-blank-lines` | `structure` | error | true | 前後が空行でない見出し |
| `heading-indent` | `structure` | error | true | `#` の前に字下げした見出し |
| `heading-level-jump` | `structure` | warning | true | 一段を超えて飛んだ見出し |
| `heading-space` | `structure` | error | true | `#` と本文を半角スペース1つで区切らない見出し |
| `heading-trailing-punctuation` | `structure` | warning | true | 末尾に句読点のある見出し |
| `indented-code-block` | `structure` | error | true | 字下げで書いたコードブロック |
| `japanese-comma` | `typography` | error | false | 日本語に隣接する半角カンマ |
| `japanese-period` | `typography` | error | false | 日本語の文を終える `。` |
| `link-label-padding` | `whitespace` | error | true | 内側に空白のあるリンクテキスト |
| `list-blank-lines` | `structure` | error | true | 前後が空行でないリスト |
| `list-marker-consistency` | `structure` | error | false | 最初の記号と違う箇条書き記号 |
| `list-marker-space` | `structure` | error | true | 記号の後ろを半角スペース1つで区切らないリスト |
| `ordered-list-marker` | `structure` | error | false | 採番の流儀が混在した順序リスト |
| `reversed-link` | `content` | error | true | 角括弧と丸括弧が逆順のリンク |
| `setext-heading` | `structure` | warning | true | 下線で見出しレベルを表した見出し |
| `single-top-level-heading` | `structure` | error | false | 2つ目以降のトップレベル見出し |
| `single-trailing-newline` | `whitespace` | error | true | 単一改行で終わらない文書末尾 |
| `table-blank-lines` | `structure` | error | true | 前後が空行でない表 |
| `table-column-count` | `structure` | error | true | 見出しより列の多い表の行 |
| `thematic-break-style` | `structure` | error | false | 最初と違う区切り線の流儀 |
| `trailing-backslash` | `whitespace` | error | true | 本文行の末尾のバックスラッシュ |
| `trailing-whitespace` | `whitespace` | error | true | 行末の空白 |

`whitespace`、`typography`、`structure`、`content` の4 groupがこれらのruleを持つ

## 整形できるrule

`bare-url`、`code-span-padding`、`consecutive-blank-lines`、`emphasis-padding`、`fence-blank-lines`、`hard-break-html`、`hard-tabs`、`heading-blank-lines`、`heading-indent`、`heading-space`、`link-label-padding`、`list-blank-lines`、`list-marker-space`、`single-trailing-newline`、`table-blank-lines`、`trailing-backslash`、`trailing-whitespace` は整形できるため `quality-check document-style lint --write` で解消する

`emphasis-marker`、`fence-style`、`list-marker-consistency`、`thematic-break-style` も整形できるが、有効にしたときだけ最初に見つけた流儀へ揃える

次のruleは `--write` の後にもerrorとして残り、本文の判断が要る

- `code-fence-language`
- `descriptive-link-text`
- `empty-link`
- `first-line-heading`
- `full-width-alphanumeric`
- `indented-code-block`
- `japanese-comma`
- `japanese-period`
- `reversed-link`
- `single-top-level-heading`
- `table-column-count`

## 判断を要求するwarning

`date-anchored-statement` は対象を確認日で識別した記述を報告する
日付そのものが判断に必要な期限や発生日は対象にならない

`heading-level-jump` は見出しの階層が一段を超えて飛んだ箇所を報告する
節を分けるほどの内容でない場合だけ、見出しの階層を下げずに残す

`heading-trailing-punctuation` は末尾に句読点のある見出しを報告する
記号そのものが判断に必要な場合だけ、句読点を削らずに残す

`emphasis-as-heading` は強調だけで作った行を見出しの代用として報告する
節を分けるほどの内容なら見出しへ変え、文の一部なら強調を解く

`descriptive-link-text` は「こちら」や `here` のような行き先を説明しないリンクテキストを報告する
リンク先を特定できる語へ変える

`setext-heading` は下線で見出しレベルを表した見出しを報告する
`#` の記法へ変えるか、区切り線のつもりなら前に空行を置く
