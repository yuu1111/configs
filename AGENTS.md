# configs

プロジェクト横断で使う共有設定の monorepo
npm パッケージとして publish する

## 構成

### config

- `packages/config/biome-config` - @yuu1111/biome-config (共有 Biome 設定)
- `packages/config/tsconfig` - @yuu1111/tsconfig (共有 TypeScript 設定)
- `packages/config/knip-config` - @yuu1111/knip-config (共有 Knip 設定)

### engine

engine 4つと `shared` は private で publish しない 唯一の公開engine `quality-check` が build 時に同梱する

- `packages/engine/code-style-check` - @yuu1111/code-style-check (関数定義の間隔の検査、private)
- `packages/engine/comment-check` - @yuu1111/comment-check (comment と抑制の検査、private)
- `packages/engine/document-style-check` - @yuu1111/document-style-check (Markdownの機械的違反の検査と文体判断の検証記録、private)
- `packages/engine/tsdoc-check` - @yuu1111/tsdoc-check (TSDoc の構文と公開契約の検査、private)
- `packages/engine/quality-check` - @yuu1111/quality-check (engine を同梱して起動する唯一の公開engine)
- `packages/engine/shared` - @yuu1111/shared (検査engineの共通処理とengine契約の型、private)

## ツールチェーン

- パッケージマネージャ: Bun
- publish: GitHub Release から npm Trusted Publisher で自動実行
- バージョニング: bun pm version (packageごとに手動)
- lint/format: Biome (self-hosting)

## コマンド

- `bun install` - 依存インストール + workspace リンク
- `bun run build` - engine と @yuu1111/shared を @yuu1111/quality-check へ同梱する
- `bunx biome check .` - lint/format チェック
- `bunx biome check --write .` - 自動修正
- `bun run check:quality` - build して全 engine を最厳格な設定で実行する
- `bun pm version patch/minor/major --no-git-tag-version` - バージョン更新 (各パッケージディレクトリで実行)

## ドキュメント

- packageのREADMEは `templates/package-readme.style.md` の記法に従い、`templates/package-readme.template.md` をひな形にする
- `README.md` を正本、`README.ja.md` を同じ見出し構成の日本語版として並べる
- 見出し構成の一致は、テストで検査できるならテストへ寄せる

## 注意点

- package の配置は `packages/config/` (共有設定) と `packages/engine/` (検査engine) に分ける
- このリポジトリ自身を最厳格な利用例にするため、`quality.json` で全 engine を有効にし、全 opt-in rule を有効にして warning は `error` へ上げる (まとめて選ぶpresetと個別に選ぶ `rules` の両方を見せ、rule名を手で並べるのは例に出す1 engineだけにする)
- `quality-check` の設定は `quality.json` だけにし、`$schema` が指す JSON Schema を `schema.json` として commit する (統合CLIは起動時に engine の `./rule-ids` から同じ語彙を読む)
- `quality-check` の `rules` は `preset`、group単位、rule単位の3段で書き、具体的な指定が勝つ (group名とrule名は engine の `RULE_GROUPS` と `RULE_IDS` が唯一の出所)
- engine をまたぐ契約 (engine契約、rule語彙、baseline、能力表) は `docs/engine-contract.md` を正本にする
- engine の rule 語彙は `rule-ids.ts` へ `RULE_IDS` / `OPT_IN_RULE_IDS` / `RULE_GROUPS` として置き、全ruleがいずれかのgroupへ重複なく入ることを tests で検査する
- Biome のネスト設定検出を避けるため、biome-config の設定ファイルは `base.json` / `react.json` (not `biome.json`)
- root の devDependencies に `workspace:*` で、rootのscriptと設定fileが使う自パッケージを参照 (シンボリックリンク用)
- engine 4つと @yuu1111/shared は private のままにし、`quality-check` の build が devDependency として同梱する (private package は公開packageの dependency にできないため)
- engine の rule 語彙は engine の `src/rule-ids.ts` へ置き、import を持たせず `./rule-ids` として公開する
- `quality-check` は engine の `./run` を in-process で呼び、`src/engines/index.ts` の `FINDING_ENGINES` に登録する
- `quality-check` の build は `src/cli.ts` を依存込みで bundle し、公開packageに runtime dependency を持たせない
- 公開する check package の `bin` は commit した `bin/cli.js` を指し、そこで `dist/cli.js` の `run` を呼ぶ (Bun は install 時に target が存在しない workspace の `bin` を `node_modules/.bin` へ link しないため)
- workspace の `bin` を変えるときは `bun.lock` の workspaces entry も同じ変更で更新する (Bun は既存 lockfile の workspaces を再計算しないため)
- GitHub Release tag は `biome-config-vX.Y.Z`、`knip-config-vX.Y.Z`、`quality-check-vX.Y.Z`、または `tsconfig-vX.Y.Z`
- npm publish はローカルで実行せず、`.github/workflows/release.yml` に任せる
- バージョン更新は `bun pm version` を使う (npm version は workspace の reify でエラーになる)
- package を追加したら、次のすべてを同じ変更で更新する: root の `README.md` と `README.ja.md` の表、この `AGENTS.md` の構成、Release tag の一覧、root の `devDependencies` の `workspace:*`、`.github/workflows/release.yml` のtag pattern
- engine を追加したら、`quality-check` の `ENGINE_NAMES`、`ENGINE_CAPABILITIES`、`FINDING_ENGINES`、README、設定表を同じ変更で更新する
- `document-style-check` の review ledger は `quality-check document-style <scan|check|lint>` として公開する
- 検出engineはbaselineを持たず、新規と解消済みの判定は統合CLIが1つのbaseline fileで行う
- `.grit` を追加したら `plugins-<layer>.json` へ列挙する (`custom-rules.test.ts` が一覧の一致を検査している)
