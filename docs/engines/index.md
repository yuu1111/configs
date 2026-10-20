# 検査engine

`quality.json` の同じ名前のsectionから検査engineを選ぶ
外部toolは利用projectへ別途導入し、4つの検出engineは `@yuu1111/quality-check` に同梱する

## 外部engine

| engine | 検査内容 |
|--------|----------|
| `biome` | Biomeのlintとformat |
| [`oxlint`](oxlint.md) | Oxlintのlint |
| [`oxfmt`](oxfmt.md) | Oxfmtのformatチェック |
| `typecheck` | TypeScriptの型検査 |
| `knip` | 未使用の依存とexport |

外部engineは利用projectの `node_modules/.bin` から解決し、baselineの対象にしない

## 同梱する検出engine

各engineは設定とruleの正本を1つ持つ

| engine | 検査内容 |
|--------|----------|
| [`code`](code.md) | 型と関数定義の間隔 |
| [`comment`](comment.md) | commentと抑制comment |
| [`markdown`](markdown.md) | Markdownの機械的違反と文体判断の検証記録 |
| [`tsdoc`](tsdoc.md) | TSDocの構文と公開契約 |

engineをまたぐ契約は [engine の共通規約](../engine-contract.md) にある
engineの一覧と配置は [構成と設計判断](../architecture.md) が説明する
