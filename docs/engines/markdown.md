# markdown

`@yuu1111/quality-check` に同梱される Markdown 検査の設定とrule
機械的に決まる違反と、人またはモデルが判断する警告を分けて持つ

## 設定例

```json
{
	"markdown": {
		"includes": [
			"docs/**",
			"!docs/CHANGELOG.md"
		],
		"rules": {
			"japanese": "on",
			"list-marker-consistency": "on"
		},
		"overrides": [
			{
				"files": [
					"docs/en/**"
				],
				"rules": {
					"japanese": "off"
				}
			}
		]
	}
}
```

`includes`、`rules`、`overrides` と `preset`、group、rule の指定は [`quality-check` の設定](../../packages/quality-check/README.ja.md) にある
このengineはin-processで起動し `args` を取らない

## rule 一覧

| Rule                           | Group         | 重大度  | Default | 検出対象                                                     |
| ------------------------------ | ------------- | ------- | ------- | ------------------------------------------------------------ |
| `bare-url`                     | `content`     | error   | true    | 角括弧で囲まれていないURL                                    |
| `blockquote-blank`             | `layout`      | warning | true    | 引用を2つに分ける空行                                        |
| `blockquote-space`             | `whitespace`  | error   | true    | `>` の後に半角スペースが2つ以上ある引用                      |
| `code-fence-language`          | `layout`      | error   | true    | 言語指定の無いコードフェンス                                 |
| `code-span-padding`            | `whitespace`  | error   | true    | 前後を半角スペースで詰めたコードスパン                       |
| `command-prompt`               | `layout`      | error   | true    | 出力を示さない `$` 付きのコマンド                            |
| `consecutive-blank-lines`      | `whitespace`  | error   | true    | 意味を持たない連続空行                                       |
| `date-anchored-statement`      | `content`     | warning | true    | 対象の識別を確認日で代用した記述                             |
| `descriptive-link-text`        | `content`     | error   | true    | 行き先を説明しないリンクテキスト                             |
| `duplicate-heading`            | `layout`      | warning | true    | 本文が同じ見出しの重複                                       |
| `emphasis-as-heading`          | `layout`      | warning | true    | 強調だけを置いた見出しの代用行                               |
| `emphasis-marker`              | `consistency` | error   | false   | 最初と違う強調記号                                           |
| `emphasis-padding`             | `whitespace`  | error   | true    | 内側に空白のある強調記号                                     |
| `empty-link`                   | `content`     | error   | true    | ラベルまたはリンク先が空のリンク                             |
| `fence-blank-lines`            | `layout`      | error   | true    | 前後が空行でないコードフェンス                               |
| `fence-style`                  | `consistency` | error   | false   | 最初と違うコードフェンスの記号                               |
| `first-line-heading`           | `consistency` | error   | false   | 先頭がトップレベル見出しでない文書                           |
| `full-width-alphanumeric`      | `japanese`    | error   | false   | `Ａ` や `１` のような全角英数字                              |
| `hard-break-html`              | `whitespace`  | error   | true    | 本文中の `<br>`                                              |
| `hard-tabs`                    | `whitespace`  | error   | true    | 字下げや区切りのハードタブ                                   |
| `heading-blank-lines`          | `layout`      | error   | true    | 前後が空行でない見出し                                       |
| `heading-indent`               | `layout`      | error   | true    | `#` の前に字下げした見出し                                   |
| `heading-level-jump`           | `layout`      | warning | true    | 一段を超えて飛んだ見出し                                     |
| `heading-space`                | `layout`      | error   | true    | `#` と本文を半角スペース1つで区切らない見出し                |
| `heading-trailing-punctuation` | `layout`      | warning | true    | 末尾に句読点のある見出し                                     |
| `indented-code-block`          | `layout`      | error   | true    | 字下げで書いたコードブロック                                 |
| `japanese-comma`               | `japanese`    | error   | false   | 日本語に隣接する半角カンマ                                   |
| `japanese-period`              | `japanese`    | error   | false   | 日本語の文を終える `。` と、日本語の直後で句点として使う `.` |
| `link-label-padding`           | `whitespace`  | error   | true    | 内側に空白のあるリンクテキスト                               |
| `list-blank-lines`             | `layout`      | error   | true    | 前後が空行でないリスト                                       |
| `list-indent`                  | `layout`      | error   | true    | 階層に合わないリストの字下げ                                 |
| `list-marker-consistency`      | `consistency` | error   | false   | 最初の記号と違う箇条書き記号                                 |
| `list-marker-space`            | `layout`      | error   | true    | 記号の後ろを半角スペース1つで区切らないリスト                |
| `ordered-list-marker`          | `consistency` | error   | false   | 採番の流儀が混在した順序リスト                               |
| `reversed-link`                | `content`     | error   | true    | 角括弧と丸括弧が逆順のリンク                                 |
| `setext-heading`               | `layout`      | warning | true    | 下線で見出しレベルを表した見出し                             |
| `single-top-level-heading`     | `consistency` | error   | false   | 2つ目以降のトップレベル見出し                                |
| `single-trailing-newline`      | `whitespace`  | error   | true    | 単一改行で終わらない文書末尾                                 |
| `table-blank-lines`            | `layout`      | error   | true    | 前後が空行でない表                                           |
| `table-column-count`           | `layout`      | error   | true    | 見出しより列の多い表の行                                     |
| `table-style`                  | `consistency` | error   | false   | 最初の表と違うパイプや区切りの流儀                           |
| `thematic-break-style`         | `consistency` | error   | false   | 最初と違う区切り線の流儀                                     |
| `trailing-backslash`           | `whitespace`  | error   | true    | 本文行の末尾のバックスラッシュ                               |
| `trailing-whitespace`          | `whitespace`  | error   | true    | 行末の空白                                                   |

`whitespace`、`layout`、`consistency`、`japanese`、`content` の5 groupがこれらのruleを持つ
`consistency` は最初に見つけた流儀へ揃える rule、`japanese` は日本語の組版の rule を集め、どちらもopt-inのruleだけを持つ

## 整形できるrule

`list-blank-lines` はCommonMarkの構文木から最上位のリストの境界を判定する
字下げだけの通常の本文、項目の継続行、入れ子のリストの内側へ空行を挿入しない

リストの前後へ空行を要求するのは文体上の規則で、Markdownの構文要件ではない
BiomeのMarkdown整形はリスト直前の空行を削るため、併用する場合は `markdown.rules.list-blank-lines` を `off` にして整形をBiomeへ任せる

`bare-url`、`blockquote-space`、`code-span-padding`、`command-prompt`、`consecutive-blank-lines`、`emphasis-padding`、`fence-blank-lines`、`hard-break-html`、`hard-tabs`、`heading-blank-lines`、`heading-indent`、`heading-space`、`link-label-padding`、`list-blank-lines`、`list-indent`、`list-marker-space`、`single-trailing-newline`、`table-blank-lines`、`trailing-backslash`、`trailing-whitespace` は整形できるため `quality-check markdown lint --write` で解消する

`emphasis-marker`、`fence-style`、`list-marker-consistency`、`table-style`、`thematic-break-style` も整形できるが、有効にしたときだけ最初に見つけた流儀へ揃える

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

`duplicate-heading` は同一文書内で本文が同じ見出しを報告する
見出しの本文を具体化するか、同じ内容の節を統合する

`blockquote-blank` は2つの引用を分ける空行を報告する
1つの引用にするなら空行へ `>` を置き、別の引用にするなら前後に地の文を挟む

`setext-heading` は下線で見出しレベルを表した見出しを報告する
`#` の記法へ変えるか、区切り線のつもりなら前に空行を置く
