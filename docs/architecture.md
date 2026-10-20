# 構成と設計判断

この文書は、この repo の package 構成を決めている理由を記録する
engine が守る契約そのものは [engine の共通規約](engine-contract.md) を正本にし、ここでは繰り返さない

## package の層

- `packages/config/` は他プロジェクトへ配布する共有設定を置く
- 統合CLI [`@yuu1111/quality-check`](../packages/quality-check/README.ja.md) は `packages/quality-check/` に直接置く
- 検査engineを1つのpackageへ統合したため、package階層ではCLIだけを囲む中間directoryは置かない
- 4つのengineは `quality-check/src/engines/{code,comment,markdown,tsdoc}/` に実装を直接置き、さらに `src/` を挟まない
- engine は共通のengine契約へ依存し、engine 同士は依存しない
- testsは `quality-check/tests/{cli,config,runner,engines,utils,package}/` に責務を対応させ、engineごとのtestsは `tests/engines/{code,comment,markdown,tsdoc}/` に置く
- packageとworkspace binの整合性は [workspace-bins.test.ts](../packages/quality-check/tests/package/workspace-bins.test.ts) で検査する

## 内部moduleの責務と依存方向

[src/cli.ts](../packages/quality-check/src/cli.ts) は公開bundleの入口として `run` をexportする薄いlauncherにする routingは [cli/main.ts](../packages/quality-check/src/cli/main.ts)、コマンドの引数と出力は `cli/commands/{check,markdown,migrate}.ts` が持つ CLI内の共通処理は `cli/{argv,selection,output,color}.ts` に分ける

設定処理は `config/{types,defaults,parse,rules,load,migrate,schema}.ts` に分ける 移行の変換処理は [config/migrate.ts](../packages/quality-check/src/config/migrate.ts) が持ち、[CLIのmigrateコマンド](../packages/quality-check/src/cli/commands/migrate.ts) は引数、入出力、終了codeを扱う 設定処理がCLIへ依存しないため、変換やschema生成をコマンドの起動なしで利用できる

実行処理は `runner/{run,external,baseline,findings,targets}.ts` に分ける engineの起動、外部toolの実行、baseline差分、検出の集約、対象fileの選択をrunnerが受け持ち、CLIのargv解析や表示処理を読み込まない

engineをまたぐ定義は `engines/{catalog,contract,registry,findings,report,legacy-names}.ts` が持つ [catalog.ts](../packages/quality-check/src/engines/catalog.ts) はengine名、能力、rule語彙のmetadataを持ち、設定parserやengine実装の登録から分ける これによりmetadataの利用だけで設定全体のparserや検出実装を読み込まずに済む 4つのengineの検出処理と、importを持たないrule語彙はそのまま保つ

依存はCLIから設定・runner・enginesへ、設定とrunnerから必要なengine契約・metadataへ向ける configはrunnerとCLIへ依存せず、runnerはCLIへ依存しない enginesはrunner、CLI、設定parserへ依存しない 各層を組み合わせるのはCLIの責務とする

低水準utilityは [files.ts](../packages/quality-check/src/utils/files.ts) と [json.ts](../packages/quality-check/src/utils/json.ts) に限る 業務上の契約や処理は所有する層へ置き、共通という理由だけのdirectoryへまとめない 内部moduleはbarrelや再exportを介さず、定義を持つmoduleから直接importする

schemaの生成scriptは [scripts/generate-schema.ts](../packages/quality-check/scripts/generate-schema.ts) に置き、runtimeのsourceから分離する schemaの構築は [config/schema.ts](../packages/quality-check/src/config/schema.ts) を使い、生成物の形式と公開先は変えない この分割ではCLI、設定、report、baseline、versionの契約を変えない

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

- 設定parserとschema生成は同じengineのrule語彙を読み、[生成script](../packages/quality-check/scripts/generate-schema.ts) が `$schema` の指す [schema.json](../packages/quality-check/schema.json) をbuild時に生成する
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
