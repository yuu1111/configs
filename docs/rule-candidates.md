# 追加するルール候補

`packages/engine` の各検査engineと `packages/config/biome-config` へ追加する価値のあるルールを整理する
この文書は候補の一覧にとどめ、採用するものは個別に実装する

## 候補を選ぶ基準

- 誤検知が無いものだけを既定で有効にし、意見が分かれるものは `--enable` のopt-inにする
- 機械的に修正できるものはfixable、人間かモデルの判断が要るものはwarningとして分ける
- 新しいruleを書く前に、Biome組み込みと既存engineに同じ検査が無いか確認する
- `biome-ignore` の理由は Biome の suppression parser が必須なので、抑制コメントへの理由付けはruleにしない

## document-style-check

`packages/engine/document-style-check/src/audit.ts` に `markdownHeadings` と `fenceStart` があるため、見出しとフェンスの候補は追加コストが小さい

| Rule | 検出 | 既定 | 元の基準 |
|------|------|------|----------|
| `code-fence-language` | 言語指定の無いコードフェンス | error / on | MD040 |
| `heading-level-jump` | h2からh4のような見出しレベルの飛び | warning / on | MD001 |
| `empty-link` | `[]()` のような空リンク | error / on | MD042 |
| `bare-url` | 本文中の裸のURL | error / on (fixable) | MD034 |
| `image-alt-text` | altの無い画像 | error / on | MD045 |

## biome-config

`packages/config/biome-config/base.json` で無効のまま残っている組み込みruleを候補にする
新しいプラグインを書く前に、実装済みで無効の組み込みを有効にする

| Rule | 分類 | 提案 |
|------|------|------|
| `useExplicitType` | `lint/nursery` | 公開境界の契約を強制するopt-in |
| `noConsole` | `lint/suspicious` | ライブラリではscopedで有効にする |
| `noImplicitCoercions` | `lint/complexity` | 好みが分かれるためopt-in |
| `noProcessEnv` | `lint/style` | 設定モジュールを強制するscoped向け |

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

1. `document-style-check` の `code-fence-language` と `heading-level-jump` — 抽出済みの見出しとフェンスを使える
