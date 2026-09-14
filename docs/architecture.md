# 構成と設計判断

この文書は、この repo の package 構成を決めている理由を記録する
engine が守る契約そのものは [engine の共通規約](engine-contract.md) を正本にし、ここでは繰り返さない

## package の層

- `packages/config/` は他プロジェクトへ配布する共有設定を置く
- `packages/engine/` は検査engineを置き、publish するのは [`@yuu1111/quality-check`](../packages/engine/quality-check/README.md) だけにする
- engine は engine 契約だけへ依存し、engine 同士は依存しない
- [`@yuu1111/shared`](../packages/engine/shared) は engine 契約の型と共通処理を持ち、publish しない

## engineを同梱する理由

- 利用者が install する package を `quality-check` ひとつに絞る
- engine 間の version は build 時に固定され、利用者の依存解決へ持ち込まれない
- 公開 package を増やさず、engine を private のまま内部APIとして変更できる
- 公開 package に runtime dependency を持たせないため、engine の依存は bundle へ畳み込む

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

## rule語彙を`./rule-ids`へ分ける理由

- 統合runnerは起動時に engine の rule 語彙を読み、`quality.json` の `$schema` が指す `schema.json` を生成する
- `./rule-ids` を import の無い module にすると、build 前でも語彙だけを読み込める
- group名とrule名は engine が唯一の出所になり、統合runnerの設定とschemaが同じ語彙を使う

## engineの説明を`docs/engines/`へ置く理由

- engine は private で publish せず、配布物に含まれるのは同梱先の `quality-check` だけである
- engine ごとに README を持つと、設定とruleの説明が4つの同型な文書へ重複する
- [`docs/engines/`](engines) を engine ごとの正本にし、共通の設定modelは `quality-check` の README が持つ
