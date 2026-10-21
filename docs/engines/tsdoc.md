# tsdoc

`@yuu1111/quality-check` に同梱される TSDoc 検査の設定とrule

## 設定例

```json
{
	"tsdoc": {
		"includes": [
			"src/**",
			"!src/generated/**"
		],
		"rules": {
			"completeness": {
				"options": {
					"scope": "documented"
				}
			},
			"style": "on",
			"tsdoc-tag": "error"
		},
		"overrides": [
			{
				"files": [
					"tests/**"
				],
				"rules": {
					"completeness": "off"
				}
			}
		]
	}
}
```

`includes`、`rules`、`overrides` と `preset`、group、rule の指定は [`quality-check` の設定](../../packages/quality-check/README.ja.md) にある
このengineはin-processで起動し `args` を取らない

## 検査する範囲

opt-inのruleは、検査する宣言の広さを `scope` というruleごとのoptionで選ぶ
省略すると `exported` になる
`scope` は `rules` の中で、ruleまたはgroupへ `{ "options": { "scope": "documented" } }` と渡す
groupへ渡したscopeは、それを受け取るruleだけに効く
opt-inのruleだけが `scope` を受け取るため、`recommended` のままでは指定しても何も変わらない

| `scope`      | 検査する宣言                                | 受け取るrule                                |
| ------------ | ------------------------------------------- | ------------------------------------------- |
| `exported`   | 公開surfaceの宣言(docの要求も同じ範囲)      | `scope` を受け取るすべてのrule              |
| `documented` | docがある宣言すべて                         | `missing-doc` 以外の `scope` を受け取るrule |
| `all`        | 関数本体の外にある宣言すべてへdocを要求する | `missing-doc` だけ                          |

公開surfaceはトップレベルの宣言のうち、`export` を付けたもの、`export { name }` が名前を挙げたもの、`export default name` と `export = name` が指すものにする
`export { name } from "..."` と `export * from "..."` は指す先の宣言がこのfileに無いため対象外にする
`all` も関数本体の中の宣言へ doc は要求しない

書かれたTSDocが正しいかだけを見るruleは `scope` を受け取らず、docがある宣言すべてを対象にする
その宣言にはトップレベルの宣言だけでなく、class、interface、type literal、namespace、enum、object literal のメンバーと、doc を付けた関数本体の中の宣言も含む
object literal のメンバーは変数の初期化式から辿り、引数、配列、as const のような式を包む構文の内側にあるものも対象にする
どのruleが `scope` を受け取るかは rule 一覧の `scope` 列にある
`orphan-doc` は宣言に付かなかったTSDoc commentを報告するため、宣言を選ぶscopeに従わない

## rule 一覧

| Rule                          | Group          | 重大度  | Default | `scope`                  | 検出対象                                           |
| ----------------------------- | -------------- | ------- | ------- | ------------------------ | -------------------------------------------------- |
| `tsdoc-syntax`                | `correctness`  | error   | true    | -                        | TSDoc parserが返す構文メッセージ                   |
| `param-mismatch`              | `correctness`  | error   | true    | -                        | signatureが宣言していないparameterを指す `@param`  |
| `type-param-mismatch`         | `correctness`  | error   | true    | -                        | 宣言に無いtype parameterを指す `@typeParam`        |
| `tsdoc-tag`                   | `correctness`  | warning | true    | -                        | TSDoc設定が定義していないtag                       |
| `orphan-doc`                  | `correctness`  | warning | true    | -                        | どの宣言にも付いていないTSDoc comment              |
| `suppression`                 | `suppressions` | error   | true    | -                        | 理由の無い抑制、未知のrule、ruleを書いていない抑制 |
| `suppression-unused`          | `suppressions` | warning | true    | -                        | 何も抑制しない抑制                                 |
| `missing-doc`                 | `completeness` | warning | false   | `exported`、`all`        | TSDoc commentの無い宣言                            |
| `param-untagged`              | `completeness` | warning | false   | `exported`、`documented` | `@param` の無い宣言済みparameter                   |
| `type-param-untagged`         | `completeness` | warning | false   | `exported`、`documented` | `@typeParam` の無い宣言済みtype parameter          |
| `param-order`                 | `completeness` | warning | false   | `exported`、`documented` | 宣言順と違う `@param` の並び                       |
| `missing-returns`             | `completeness` | warning | false   | `exported`、`documented` | `@returns` の無い値を返す関数                      |
| `deprecated-without-guidance` | `completeness` | warning | false   | `exported`、`documented` | 代替先を示さない `@deprecated`                     |
| `single-line-doc`             | `style`        | warning | false   | `exported`、`documented` | 1行で書いたTSDoc comment                           |
| `blank-line-before-tags`      | `style`        | warning | false   | `exported`、`documented` | summaryの直下に書いたblock tag                     |

`correctness` は書かれたTSDocが正しいかを見る rule、`suppressions` は抑制の理由と使用状況を見る rule で、すべて既定で有効になる
`suppressions` groupは `suppression` ruleと名前を分け、group全体と個別のruleを別々に指定できる
旧設定と抑制directiveの互換性は [engine名の移行と互換性](../engine-contract.md#engine名の移行と互換性) にある
`completeness` は書き足りないものを咎める rule、`style` は書いたTSDocの体裁を見る rule で、どちらもopt-inのため `rules` が `on` にするまで実行しない
そのため `preset` の `recommended` は書かれたTSDocの構文と契約の整合だけを検査し、docの有無と体裁を要求しない

`warn` と `error` はruleの重大度を変更し、opt-inのruleは先に有効にする

## tagと構文

`blank-line-before-tags` はsummaryと最初のblock tagの間に空の `*` 行を要求し、tagの並びを説明の1行下から始めさせる
空行より下のtagは続けて並べ、summaryを持たずtagで始まるcommentは対象外にする

TSDocが定義していないtagは `tsdoc-tag` のwarningになる
`@description` などの独自tagもそこで報告し、`correctness` groupの `tsdoc-tag` を `error` にするとすべてerrorへ上がる

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
// tsdoc-ignore missing-doc: the loader reads this value
export const value = 1;
```

理由の無い抑制、未知のrule、ruleを書いていない抑制は `suppression` のerrorになる
何も抑制しない抑制は `suppression-unused` のwarningになる
`orphan-doc` は付ける先の宣言が無いTSDocへの指摘なので、宣言の隣に抑制を書いても効かない
