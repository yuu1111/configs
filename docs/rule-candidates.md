# 追加するルール候補

`packages/engine` の各検査engineと `packages/config/biome-config` へ追加する価値のあるルールを整理する
この文書は候補の一覧にとどめ、採用するものは個別に実装する

## 候補を選ぶ基準

- 誤検知が無いものだけを既定で有効にし、意見が分かれるものは `--enable` のopt-inにする
- 機械的に修正できるものはfixable、人間かモデルの判断が要るものはwarningとして分ける
- 新しいruleを書く前に、Biome組み込みと既存engineに同じ検査が無いか確認する

## tsdoc-check

`packages/engine/tsdoc-check/src/rules.ts` の `param-mismatch` はタグからシグネチャ方向の照合だけで、宣言側の引数がタグを持つかを見ていない
逆向きの照合を追加する

| Rule | 検出 | 既定 |
|------|------|------|
| `param-untagged` | 引数を持つが `@param` が無い | warning / on |
| `type-param-untagged` | 型引数を持つが `@typeParam` が無い | warning / on |
| `param-order` | `@param` の並びが宣言順と違う | warning / opt-in |
| `missing-returns` | 値を返す関数に `@returns` が無い | warning / opt-in |
| `deprecated-without-guidance` | `@deprecated` に代替の案内が無い | warning / opt-in |

`param-untagged` は `declaration.parameters` を回す分岐を足すだけで済む
既存の `promoteFindings` により `--error` での昇格もそのまま使える

## comment-check

| Rule | 検出 | 既定 |
|------|------|------|
| `undocumented-suppression` | `biome-ignore` に `: 理由` が無い | error / on |
| `dated-comment` | コメント中の日付アンカー | warning / on |
| `unowned-todo` | `TODO` や `FIXME` にissueやownerの参照が無い | opt-in |

`undocumented-suppression` は tsdoc-check の「理由の無い抑制はerror」と対になる基準で、`biome-ignore` に理由を要求する
Biome CLIの `--suppress` には理由を必須にするオプションが無いため、組み込みruleとは重複しない
既存の `undocumented-directive` の対象を `biome-ignore-all` へ広げる形でも実装できる

`dated-comment` は document-style-check の `date-anchored-statement` と同じ基準をコメントへ適用し、engine間で判断を揃える

## document-style-check

`packages/engine/document-style-check/src/audit.ts` に `markdownHeadings` と `fenceStart` があるため、見出しとフェンスの候補は追加コストが小さい

| Rule | 検出 | 既定 | 元の基準 |
|------|------|------|----------|
| `code-fence-language` | 言語指定の無いコードフェンス | error / on | MD040 |
| `heading-level-jump` | h2からh4のような見出しレベルの飛び | warning / on | MD001 |
| `empty-link` | `[]()` のような空リンク | error / on | MD042 |
| `bare-url` | 本文中の裸のURL | error / on (fixable) | MD034 |
| `image-alt-text` | altの無い画像 | error / on | MD045 |
| `list-marker-consistency` | `-` と `*` の混在 | opt-in (fixable) | MD004 |
| `japanese-comma` | 日本語文の `,` | opt-in | — |
| `full-width-alphanumeric` | `ＡＢＣ１２３` のような全角英数 | opt-in | — |

`japanese-comma` と `full-width-alphanumeric` は `japanese-period` と同じく、日本語の文書だけで有効にするopt-inに置く

## biome-config

`packages/config/biome-config/base.json` は recommended と4つのruleだけを有効にしている
新しいプラグインを書く前に、実装済みで無効の組み込みを有効にする

| Rule | 分類 | 提案 |
|------|------|------|
| `noFloatingPromises` | `lint/nursery` | warn |
| `useErrorCause` | `lint/style` | warn |
| `useExplicitType` | `lint/nursery` | 公開境界の契約を強制するopt-in |
| `noConsole` | `lint/suspicious` | ライブラリではscopedで有効にする |
| `noImplicitCoercions` | `lint/complexity` | 好みが分かれるためopt-in |
| `noProcessEnv` | `lint/style` | 設定モジュールを強制するscoped向け |

`noFloatingPromises` は未処理のPromiseを報告し、実害が出るため最初に有効にする
`useErrorCause` はcatchで包み直して元の原因を捨てる記述を報告する

## Gritプラグイン候補

Biome組み込みに対応が無いものだけをプラグインにする
既存の `plugins/*` と同じく、プリセットをextendするまで無効になる

- `plugins/core/no-boolean-argument` — 呼び出し側の `save(true, false)` のような真偽値リテラル引数を報告する
- `plugins/network/require-fetch-response-ok` — `fetch` の結果を `response.ok` で確認せずに使う場合を報告し、`require-fetch-abort-signal` と対になる
- `plugins/discord/require-collector-time-limit` — `createMessageCollector` や `awaitMessages` に `time` が無い場合を報告し、コレクタのリークにつながる

## AGENTS.mdへ足す運用ルール

- packageを追加したら、次のすべてを同じ変更で更新する
	- rootの `README.md` と `README.ja.md` の表
	- `AGENTS.md` の構成
	- Release tagの一覧
	- rootの `devDependencies` の `workspace:*`
	- `.github/workflows/release.yml` のtag pattern
- engineを追加したら、`quality-check` の `ENGINE_NAMES`、README、設定表を更新する
- `.grit` を追加したら `plugins-<layer>.json` へ列挙する（`custom-rules.test.ts` が一覧の一致を検査している）
- `README.md` と `README.ja.md` の見出し構成の一致は、テストで検査できるならテストへ寄せる

## 着手する順序

1. `tsdoc-check` の `param-untagged` — 変更が小さく、検査の穴が明確
2. `comment-check` の `undocumented-suppression` — 抑制に理由を要求する基準が揃う
3. `document-style-check` の `code-fence-language` と `heading-level-jump` — 抽出済みの見出しとフェンスを使える
4. `base.json` の `noFloatingPromises` — 組み込みの有効化だけで実害を減らせる
