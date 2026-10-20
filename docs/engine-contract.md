# engine の共通規約

`packages/quality-check/` 内の検査engineと統合runnerの間で守る契約をまとめる
個別のoptionとruleは `docs/engines/<engine>.md` が持ち、この文書はengineをまたぐ約束だけを扱う

## 用語

- 検出engine — 報告を返しbaselineの対象になるengine 現在は `code-style-check` `comment-check` `document-style-check` `tsdoc-check`
- 起動engine — `quality-check` が起動する単位 外部toolの `biome` `oxlint` `oxfmt` `typecheck` `knip` も含む
- rule語彙 — engineが内部moduleとして提供するrule識別子の一覧
- baseline — 統合runnerが持つ差分判定の基準file

## engine の契約

### 内部moduleの配置と配布

- 統合CLIは `packages/quality-check/` に直接置き、検出engineと共通処理は内部moduleにする
- engineの実装は `quality-check/src/engines/{code-style,comment,document-style,tsdoc}/` に直接置き、さらに `src/` を挟まない
- 共通処理は `quality-check/src/shared/` に置く
- testsは `quality-check/tests/engines/{code-style,comment,document-style,tsdoc}/` と `quality-check/tests/shared/` に置く
- 公開する `quality-check` が build 時に内部engine、共通処理とその依存を bundle し、runtime dependency を持たない
- engineごとの `rule-ids.ts` に `RULE_IDS` `OPT_IN_RULE_IDS` `RULE_GROUPS` を置き import を持たせない
- 検査するfileの拡張子を `FILE_EXTENSIONS` として `rule-ids.ts` へ置き、統合runnerが上書きでfileを分けるときに使う
- ruleごとのoptionの語彙も `rule-ids.ts` の `RULE_OPTIONS` へ置く (`tsdoc-check` の `scope` とその選択肢)
- 全ruleがいずれかのgroupへ重複なく入ることを tests で検査する
- rule語彙と、検出の `run`、整形の `fix`、review ledger の `audit` の契約は内部moduleとして保ち、packageの公開subpath exportsにはしない
- 個別コマンドのargv解析と出力は `quality-check` が持ち、CLI、設定名とrule IDは変えない

### in-process 呼び出し

- 検出engineは子プロセスではなく関数として呼ぶ
- [`src/shared/engines.ts`](../packages/quality-check/src/shared/engines.ts) の `FindingEngineContext` が `cwd` `includes` `rules` `targets` を渡す
- ruleごとの `options` は `RuleSelection` へ載せ 統合runnerが検証してから渡す engineは既定値へ倒して読む
- `FindingEngine` は [`src/shared/report.ts`](../packages/quality-check/src/shared/report.ts) の `EngineReport` を返す
- 検出engineは終了codeを持たない 起動の失敗は例外にし 統合runnerがengineのerrorへ変換する
- `quality-check` は `src/engines/index.ts` の `FINDING_ENGINES` で全検出engineを登録する

### 検出の型

検出1件は `file` `line` `column` `rule` `message` `severity` を持つ
型と分類は [`src/shared/report.ts`](../packages/quality-check/src/shared/report.ts) が唯一の出所になり engineは `toReport` を使う
統合runnerは `normalizeReport` でengine名と `text` を補う

### rule語彙

- 統合runnerの `rules` は preset とgroup とruleの3段で解決し `RuleSelection` へ展開する rule名とgroup名は `rules` の直下へ並べて書く
- `RuleSelection` は `enable` `disable` `warn` `error` とruleごとの `options` を持ち engineの関数へそのまま渡す
- `overrides` は統合runnerが検出engineの起動前に解く fileごとにrule選択を畳み 同じ選択になるfileをまとめてengineを起動する engineは `overrides` を知らない
- group名とrule名は engine の `RULE_GROUPS` と `RULE_IDS` が唯一の出所になり、同じengine内で重複させない

## 統合runner の契約

### engine の能力

engineの能力は `packages/quality-check/src/config.ts` の `ENGINE_CAPABILITIES` が唯一の出所になる
`findings` は検出engineかどうか、`args` は追加の引数を受け取るか、`skipped` は受け取らない起動条件とその理由を持つ
rule語彙の有無は `RULE_VOCABULARY` が持つ

| engine | 起動 | 設定で受け取る起動条件 |
|--------|------|------------------------|
| `biome` | 子プロセス | args |
| `oxlint` | 子プロセス | args |
| `oxfmt` | 子プロセス | args |
| `typecheck` | 子プロセス | args projects |
| `knip` | 子プロセス | args |
| `code-style-check` | in-process | includes rules overrides |
| `comment-check` | in-process | includes rules overrides |
| `document-style-check` | in-process | includes rules overrides |
| `tsdoc-check` | in-process | includes rules overrides |

`args` は子プロセスengineだけが受け取り 既定引数の後ろへ足す
外部engineは利用projectのdevDependenciesへ入れ、`node_modules/.bin` から解決する
`FINDING_ENGINES` への登録もbundleも行わない

- Oxlintは `oxlint [targets] [args]` を起動し、`--ignore` を繰り返しの `--ignore-pattern <ignore>` へ変換する
- Oxfmtは `oxfmt --check [targets] [args]` を起動し、既定ではfileを書き換えない
- Oxfmtは `--ignore` を受け取らずskipを表示し、除外は `.oxfmtrc.json` とignore fileで指定する

### 個別コマンド

- `quality-check document-style <scan|check|lint>` が文書向けの個別コマンドになる
- argv解析と出力は quality-check が持ち、engineの `run` `fix` `audit` は内部moduleの関数契約として使う
- `lint` は統合runが使う内部 `run` moduleと同じ関数を呼ぶ

### 実行

- 起動順は `biome` → `oxlint` → `oxfmt` → `typecheck` → `knip` → `code-style-check` → `comment-check` → `document-style-check` → `tsdoc-check` で、`ENGINE_NAMES` が正本になる
- 位置引数のうちengine名と一致するものは起動するengineの選択になり、残りは対象pathになる
- engine選択時はbaseline差分を起動するengineに絞り、`--update-baseline` との併用は拒否する
- 検出engineの検出は統合runnerが1つのbaseline fileでまとめて差分し 増えた検出だけを阻害する
- `failOnWarnings` がtrueなら検出engineのwarningを阻害する検出へ変え、Biomeへ `--error-on-warnings`、Oxlintへ `--deny-warnings` を渡す
- 終了codeは 0 が全engine成功 1 が阻害する検出またはengineの失敗 2 が設定または起動の失敗

### 変更の手順

- ruleを足したengineは統合runnerのminorを上げる
- 出力またはoptionの削除はmajorを上げる
- `quality.json` を破壊的に変えるreleaseは旧書式を通常の読込では受け入れず、変更previewを既定にして `--write` で適用するmigration command (`quality-check migrate`) を同時に提供する
- 自動変換できない設定が1つでもあればmigration commandはfile全体を書き換えず、必要な手作業を出力する
- 形式を判別できない設定は推測で移行せず、旧v5形式を明示する `--from-v5` または意図する `enabled` とruleの手動指定を案内する
- `schema.json` は `bun run build` で再生成してcommitする
- `README.md` `README.ja.md` `AGENTS.md` の一覧と `bun.lock` のworkspaces entryを同じ変更で更新する

## 未統合のもの

- `biome` の `.grit` ルールはrule語彙を公開していない
- `biome` `oxlint` `oxfmt` `typecheck` `knip` はbaselineと検出へ参加しない
