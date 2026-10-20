# 構成と設計判断

この文書は、この repo の package 構成を決めている理由を記録する
engine が守る契約そのものは [engine の共通規約](engine-contract.md) を正本にし、ここでは繰り返さない

## package の層

- `packages/config/` は他プロジェクトへ配布する共有設定を置く
- 統合CLI [`@yuu1111/quality-check`](../packages/quality-check/README.ja.md) は `packages/quality-check/` に直接置く
- 検査engineを1つのpackageへ統合したため、CLIだけを囲む中間directoryは置かない
- 4つのengineは `quality-check/src/engines/{code,comment,markdown,tsdoc}/` に実装を直接置き、さらに `src/` を挟まない
- engine は共通のengine契約へ依存し、engine 同士は依存しない
- `quality-check/src/shared/` はengine契約の型と共通処理を持つ
- 対応するtestsは `quality-check/tests/engines/{code,comment,markdown,tsdoc}/` と `quality-check/tests/shared/` に置く

## engineを同梱する理由

- 利用者が install する package を `quality-check` ひとつに絞る
- engineと共通処理は同じpackageの内部moduleとして変更し、単独のversionやworkspace依存を管理しない
- 以前の5つのprivate packageの `package.json` をなくし、公開単位と一致しないpackage境界の保守を減らす
- `run` `fix` `audit` と import の無い `rule-ids.ts` の内部契約は保ち、packageの公開subpath exportsにはしない
- 公開 package に runtime dependency を持たせないため、engine の依存は bundle へ畳み込む

## 外部toolを子プロセスで呼ぶ理由

- Biome、Oxlint、Oxfmt、TypeScript、Knipは利用projectのdevDependenciesへ入れ、`node_modules/.bin` から解決する
- 外部toolはbundleせず、利用projectがversionと固有設定を管理する
- 外部toolの終了codeを検査結果に使い、同梱する検出engineのbaselineへは含めない
- Oxfmtは既定で `--check` を付け、検査中にfileを書き換えない
- このrepoではOxfmtにYAMLだけを任せ、Biomeとformat対象を分ける

## in-processで呼ぶ理由

- engine を子プロセスにすると、argv解析と出力形式が engine ごとに増える
- in-process にすると検出の型を engine 間で共有でき、統合runnerは engine 名と text を補うだけで済む
- engine は終了codeを持たず、起動の失敗を例外にして統合runnerが engine error へ変換する

## baselineを統合runnerが持つ理由

- 検出engineごとに基準fileがあると、判定規則と無効化の扱いが engine ごとにずれる
- 1つの `quality-baseline.json` へ集約すると、新規と解消済みを同じ規則で判定できる
- engine は見つけた検出をすべて報告するだけになり、基準の状態を持たない

## `bin/cli.js` をcommitする理由

- Bun は install 時に target の存在しない workspace の `bin` を `node_modules/.bin` へ link しない
- そのため `bin/cli.js` を commit し、そこで `dist/cli.js` の `run` を呼ぶ
- `bin` を変えるときは `bun.lock` の workspaces entry も同じ変更で更新する

## rule語彙を内部の`rule-ids.ts`へ分ける理由

- 統合runnerは起動時に engine の rule 語彙を読み、`quality.json` の `$schema` が指す `schema.json` を生成する
- engineごとの `rule-ids.ts` を import の無い内部moduleにすると、build 前でも語彙だけを読み込める
- group名とrule名は engine が唯一の出所になり、統合runnerの設定とschemaが同じ語彙を使う
- rule名とgroup名は `rules` の直下へ並べて書くため、同じengine内で両者の名前を重複させない
- tsdocのgroupは `suppressions` とし、ruleの `suppression` と区別する

## `overrides` を統合runnerで解く理由

- fileごとのrule選択は、検出が `file` と `rule` を持つため、engineの外で解決できる
- engineへ `overrides` を渡すと4つのengineが同じ解決を持つ そこで統合runnerがfileごとにrule選択を畳み、同じ選択になるfileをまとめてengineを起動する
- engineの内部 `run` moduleの契約は変えず、`overrides` を使わない設定では起動は1回のままになる

## engineの説明を`docs/engines/`へ置く理由

- engineは `quality-check` の内部moduleであり、単独のpackageや公開APIを持たない
- engine ごとに README を持つと、設定とruleの説明が4つの同型な文書へ重複する
- [`docs/engines/`](engines/index.md) を engine ごとの正本にし、共通の設定modelは `quality-check` の README が持つ
