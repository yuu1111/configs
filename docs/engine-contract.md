# engine の共通規約

`packages/engine/` の検査engineと統合CLIの間で守る契約をまとめる
個別のoptionとruleは各engineのREADMEが持ち、この文書はengineをまたぐ約束だけを扱う

## 用語

- 検出engine — `--json` で検出を返すengine 現在は `code-style-check` `comment-check` `document-style-check` `tsdoc-check`
- 起動engine — `quality-check` が起動する単位 外部toolの `biome` `typecheck` `knip` も含む
- rule語彙 — engineが公開するrule識別子の一覧
- baseline — 統合CLIが持つ差分判定の基準file

## engine の契約

### CLI

- 終了codeは 0 が検出なし 1 が阻害する検出あり 2 が起動または設定の失敗
- 検出engineは `--json` と `--ignore <path>` と対象pathを受け取る
- rule語彙を持つengineは `--disable <rule>` を受け取る さらにopt-inのruleを持つengineは `--enable <rule>` を 違反へ上げられるengineは `--error <rule>` も受け取る
- 未知のrule名と未知のoptionは設定errorにし 打ち間違いが黙って無視されないようにする
- baselineをengine自身は持たない 新規と解消済みの判定は統合CLIだけが行う

### 検出のJSON

`--json` は `errors` と `warnings` の2つの配列を持つobjectを出力する 検出1件は `file` `line` `column` `rule` `severity` `message` を持つ

```json
{
        "errors": [
                {
                        "column": 2,
                        "file": "src/queue.ts",
                        "line": 18,
                        "message": "placeholder comment should be resolved or tracked",
                        "rule": "placeholder-comment",
                        "severity": "error"
                }
        ],
        "warnings": []
}
```

型と読み書きは `@yuu1111/shared/report` が唯一の出所になる engineは `toReport` と `printReport` を使い 統合CLIは `readReport` を使う

人間向けの出力は検出ごとの `<file>:<line>:<column> <rule> <severity> <message>` と 最後の `Checked <n> files: <e> errors, <w> warnings` にする

### rule語彙

- `src/rule-ids.ts` に `RULE_IDS` `OPT_IN_RULE_IDS` `RULE_GROUPS` を置く
- 全ruleがいずれかのgroupへ重複なく入ることを tests で検査する
- 語彙は import を持たせず `./rule-ids` として公開する 公開する型をprivateな `@yuu1111/shared` へ依存させないため
- 統合CLIの `rules` は preset とgroup とruleの3段で解決し `off` `on` `error` を `--disable` `--enable` `--error` へ展開する

### package

- `bin/cli.js` をcommitし `dist/cli.js` の `run` を呼ぶ
- buildは `@yuu1111/shared` をbundleし `./rule-ids` は `--external` にしてrule語彙を実行時に読む
- `files` に `bin` `dist` `README.ja.md` と `src/rule-ids.ts` を含める 語彙を持たないengineはその限りではない

## 統合CLI の契約

### engine の能力

engineの能力は `packages/engine/quality-check/src/config.ts` の `ENGINE_CAPABILITIES` が唯一の出所になる `findings` は検出engineかどうかを `skipped` は受け取らない起動条件とその理由を持つ rule語彙の有無は `RULE_VOCABULARY` が持つ

| engine | findings | 設定で受け取る起動条件 |
|--------|----------|------------------------|
| `biome` | false | targets |
| `typecheck` | false | なし 対象のtsconfigは `projects` が持つ |
| `knip` | false | なし 設定は `knip.ts` が持つ |
| `code-style-check` | true | ignore targets rules |
| `comment-check` | true | ignore targets rules |
| `document-style-check` | true | ignore targets rules |
| `tsdoc-check` | true | ignore targets rules |

`args` はどのengineも受け取り 既定引数の後ろへ足す

### 実行

- 起動順は `ENGINE_NAMES` の並び
- 検出engineの検出は統合CLIが1つのbaseline fileでまとめて差分し 増えた検出だけを阻害する
- `failOnWarnings` がtrueならwarningも阻害する検出として扱う
- 終了codeは 0 が全engine成功 1 が阻害する検出またはengineの失敗 2 が設定または起動の失敗

### 変更の手順

- ruleを足したengineはminorを上げ 統合CLIの `peerDependencies` の下限をその版へ合わせる rule語彙を持つengineは統合CLIのpeerDependencyでもある
- 出力またはoptionの削除はmajorを上げる
- `schema.json` は `bun run build` で再生成してcommitする
- `README.md` `README.ja.md` `AGENTS.md` の一覧と `bun.lock` のworkspaces entryを同じ変更で更新する

## 未統合のもの

- `biome` の `.grit` ルールはrule語彙を公開していない
- `biome` `typecheck` `knip` はbaselineと検出JSONへ参加しない
- rule名の引数解析はengineごとに実装が重複している
