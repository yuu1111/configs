# 検査engine

`@yuu1111/quality-check` に同梱される4つの検出engine
各engineは設定とruleの正本を1つ持ち、`quality.json` の同じ名前のsectionから選ぶ

| engine | 検査内容 |
|--------|----------|
| [`code-style-check`](code-style-check.md) | 型と関数定義の間隔 |
| [`comment-check`](comment-check.md) | commentと抑制comment |
| [`document-style-check`](document-style-check.md) | Markdownの機械的違反と文体判断の検証記録 |
| [`tsdoc-check`](tsdoc-check.md) | TSDocの構文と公開契約 |

engineをまたぐ契約は [engine の共通規約](../engine-contract.md) にある
engineの一覧と配置は [構成と設計判断](../architecture.md) が説明する
