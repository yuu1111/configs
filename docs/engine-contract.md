# engine の共通規約

`packages/engine/` の検査engineと統合runnerの間で守る契約をまとめる
個別のoptionとruleは `docs/engines/<engine>.md` が持ち、この文書はengineをまたぐ約束だけを扱う

## 用語

- 検出engine — 報告を返しbaselineの対象になるengine 現在は `code-style-check` `comment-check` `document-style-check` `tsdoc-check`
- 起動engine — `quality-check` が起動する単位 外部toolの `biome` `typecheck` `knip` も含む
- rule語彙 — engineが公開するrule識別子の一覧
- baseline — 統合runnerが持つ差分判定の基準file

## engine の契約

### package

- 検出engineと `shared` は private な workspace package とし publish しない
- 公開する `quality-check` が build 時に engine と `@yuu1111/shared` と外部依存を bundle し、runtime dependency を持たない
- `src/rule-ids.ts` に `RULE_IDS` `OPT_IN_RULE_IDS` `RULE_GROUPS` を置き import を持たせない
- 全ruleがいずれかのgroupへ重複なく入ることを tests で検査する
- `./rule-ids` と、検出の `./run`、整形の `./fix`、review ledger の `./audit` を公開する
- engine の package は振る舞いの関数だけを公開し、個別コマンドのargv解析と出力は `quality-check` が持つ

### in-process 呼び出し

- 検出engineは子プロセスではなく関数として呼ぶ
- `@yuu1111/shared/engines` の `FindingEngineContext` が `cwd` `ignores` `rules` `targets` を渡す
- `FindingEngine` は `@yuu1111/shared/report` の `EngineReport` を返す
- 検出engineは終了codeを持たない 起動の失敗は例外にし 統合runnerがengineのerrorへ変換する
- `quality-check` は `src/engines/index.ts` の `FINDING_ENGINES` で全検出engineを登録する

### 検出の型

検出1件は `file` `line` `column` `rule` `message` `severity` を持つ
型と分類は `@yuu1111/shared/report` が唯一の出所になり engineは `toReport` を使う
統合runnerは `normalizeReport` でengine名と `text` を補う

### rule語彙

- 統合runnerの `rules` は preset とgroup とruleの3段で解決し `RuleSelection` へ展開する
- `RuleSelection` は `enable` `disable` `error` を持ち engineの関数へそのまま渡す
- group名とrule名は engine の `RULE_GROUPS` と `RULE_IDS` が唯一の出所になる

## 統合runner の契約

### engine の能力

engineの能力は `packages/engine/quality-check/src/config.ts` の `ENGINE_CAPABILITIES` が唯一の出所になる
`findings` は検出engineかどうか、`args` は追加の引数を受け取るか、`skipped` は受け取らない起動条件とその理由を持つ
rule語彙の有無は `RULE_VOCABULARY` が持つ

| engine | 起動 | 設定で受け取る起動条件 |
|--------|------|------------------------|
| `biome` | 子プロセス | targets args |
| `typecheck` | 子プロセス | args projects |
| `knip` | 子プロセス | args |
| `code-style-check` | in-process | ignore targets rules |
| `comment-check` | in-process | ignore targets rules |
| `document-style-check` | in-process | ignore targets rules |
| `tsdoc-check` | in-process | ignore targets rules |

`args` は子プロセスengineだけが受け取り 既定引数の後ろへ足す

### 個別コマンド

- `quality-check document-style <scan|check|lint>` が文書向けの個別コマンドになる
- argv解析と出力は quality-check が持ち、engine は `./run` `./fix` `./audit` の関数だけを公開する
- `lint` は統合runが使う `./run` と同じ関数を呼ぶ

### 実行

- 起動順は `ENGINE_NAMES` の並び
- 検出engineの検出は統合runnerが1つのbaseline fileでまとめて差分し 増えた検出だけを阻害する
- `failOnWarnings` がtrueならwarningも阻害する検出として扱う
- 終了codeは 0 が全engine成功 1 が阻害する検出またはengineの失敗 2 が設定または起動の失敗

### 変更の手順

- ruleを足したengineは統合runnerのminorを上げる
- 出力またはoptionの削除はmajorを上げる
- `schema.json` は `bun run build` で再生成してcommitする
- `README.md` `README.ja.md` `AGENTS.md` の一覧と `bun.lock` のworkspaces entryを同じ変更で更新する

## 未統合のもの

- `biome` の `.grit` ルールはrule語彙を公開していない
- `biome` `typecheck` `knip` はbaselineと検出へ参加しない
