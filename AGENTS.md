# configs

プロジェクト横断で使う共有設定の monorepo
npm パッケージとして publish する

## 構成

### config

- `packages/config/biome-config` - @yuu1111/biome-config (共有 Biome 設定)
- `packages/config/tsconfig` - @yuu1111/tsconfig (共有 TypeScript 設定)
- `packages/config/knip-config` - @yuu1111/knip-config (共有 Knip 設定)

### engine

engine 4つと `shared` は private で publish せず、唯一の公開engine `quality-check` が build 時に同梱する

- `packages/engine/code-style-check` - @yuu1111/code-style-check (関数定義の間隔の検査)
- `packages/engine/comment-check` - @yuu1111/comment-check (comment と抑制の検査)
- `packages/engine/document-style-check` - @yuu1111/document-style-check (Markdownの機械的違反の検査と文体判断の検証記録)
- `packages/engine/tsdoc-check` - @yuu1111/tsdoc-check (TSDoc の構文と公開契約の検査)
- `packages/engine/quality-check` - @yuu1111/quality-check (engine を同梱して起動する唯一の公開engine)
- `packages/engine/shared` - @yuu1111/shared (検査engineの共通処理とengine契約の型)

## パッケージと公開

- package の配置は `packages/config/` (共有設定) と `packages/engine/` (検査engine) に分ける
- root の devDependencies に `workspace:*` で、root の script と設定 file が使う自パッケージを参照する (シンボリックリンク用)
- `quality-check` の build は `src/cli.ts` を依存込みで bundle し、公開 package に runtime dependency を持たせない
- 公開する check package の `bin` は commit した `bin/cli.js` を指し、そこで `dist/cli.js` の `run` を呼ぶ (Bun は install 時に target が存在しない workspace の `bin` を `node_modules/.bin` へ link しないため)
- workspace の `bin` を変えるときは `bun.lock` の workspaces entry も同じ変更で更新する (Bun は既存 lockfile の workspaces を再計算しないため)

## engine の規約

- engine をまたぐ契約 (engine 契約、rule 語彙、baseline、能力表) は `docs/engine-contract.md` を正本にする
- engine の rule 語彙は `src/rule-ids.ts` へ `RULE_IDS` / `OPT_IN_RULE_IDS` / `RULE_GROUPS` として置き、import を持たせず `./rule-ids` として公開する
- 全 rule がいずれかの group へ重複なく入ることを tests で検査する
- engine の package は `./run` `./fix` `./audit` の関数だけを公開し、個別コマンドの argv 解析と出力は `quality-check` が持つ
- `quality-check` は engine の `./run` を in-process で呼び、`src/engines/index.ts` の `FINDING_ENGINES` に登録する
- 検出engineは baseline を持たず、新規と解消済みの判定は統合CLIが1つの baseline file で行う
- `document-style-check` の review ledger は `quality-check document-style <scan|check|lint>` として公開する
- `.grit` を追加したら `plugins-<layer>.json` へ列挙する (`custom-rules.test.ts` が一覧の一致を検査している)

## quality-check の設定

- 設定は `quality.json` だけにし、`$schema` が指す JSON Schema を `schema.json` として commit する (統合CLIは起動時に engine の `./rule-ids` から同じ語彙を読む)
- `rules` は `preset`、group単位、rule単位の3段で書き、具体的な指定が勝つ (group名とrule名は engine の `RULE_GROUPS` と `RULE_IDS` が唯一の出所)
- このリポジトリ自身を最厳格な利用例にするため、全 engine を有効にし、全 opt-in rule を有効にして warning は `error` へ上げる
- `preset` でまとめて選ぶ形と `rules` で個別に選ぶ形の両方を見せ、rule名を手で並べる例は1 engine だけにする

## ツールチェーン

- パッケージマネージャ: Bun
- publish: GitHub Release から npm Trusted Publisher で自動実行
- バージョニング: `bun pm version`
- lint/format: Biome
- biome-config の設定ファイルは `base.json` / `react.json` (not `biome.json`) とし、Biome のネスト設定検出を避ける

## コマンド

- `bun install` - 依存インストール + workspace リンク
- `bun run build` - engine と @yuu1111/shared を @yuu1111/quality-check へ同梱する
- `bunx biome check .` - lint/format チェック
- `bunx biome check --write .` - 自動修正
- `bun run check:quality` - build して全 engine を最厳格な設定で実行する
- `bun pm version patch/minor/major --no-git-tag-version` - バージョン更新 (各パッケージディレクトリで実行)

## リリース

- GitHub Release tag は `biome-config-vX.Y.Z`、`knip-config-vX.Y.Z`、`quality-check-vX.Y.Z`、`tsconfig-vX.Y.Z` のいずれか
- npm publish はローカルで実行せず、`.github/workflows/release.yml` に任せる
- バージョン更新は `bun pm version` を使う (`npm version` は workspace の reify でエラーになるため)

## ドキュメント

- package の README は `templates/package-readme.style.md` の記法に従い、`templates/package-readme.template.md` をひな形にする
- `README.md` を正本、`README.ja.md` を同じ見出し構成の日本語版として並べる
- 見出し構成の一致は、テストで検査できるならテストへ寄せる
- リポジトリ全体の文書は `docs/` に日本語で置き、入口は root の `README.md` と `README.ja.md` の `## Documents` にする
- 設計判断は `docs/architecture.md`、engine をまたぐ契約は `docs/engine-contract.md`、導入は `docs/adoption.md` に分ける
- 同梱する private engine は README を持たず、設定とruleの正本を `docs/engines/<engine>.md` にする

## ドキュメントサイト

- VitePress で `docs/` と公開 package の README を1つの木から組み、`bun run docs:build` が `.vitepress/dist` を作る 配信は `.github/workflows/docs.yml` が GitHub Pages へ行う
- locale は日本語を既定にし英語を `/en/` に置く 翻訳がある文書だけを `en` へ置き、翻訳が無い文書の `en` は作らない
- `README.md` は npm と GitHub が要求する位置を動かせないため、`.vitepress/config.mts` の `rewrites` で `/en/` と `/` へ割り当てる
- 相対リンクは rewrite 後の配置を基準に解決されるため、同じ config が原稿の配置を基準に route へ直す

## 変更時の同時更新

- package を追加したら、次のすべてを同じ変更で更新する
  - root の `README.md` と `README.ja.md` の表
  - この `AGENTS.md` の構成
  - GitHub Release tag の一覧
  - root の `devDependencies` の `workspace:*`
  - `.github/workflows/release.yml` の tag pattern
- engine を追加したら、次のすべてを同じ変更で更新する
  - `quality-check` の `ENGINE_NAMES`
  - `quality-check` の `ENGINE_CAPABILITIES`
  - `quality-check` の `FINDING_ENGINES`
  - `docs/engines/<engine>.md` と root README の `## Documents`
  - README と設定表
- rule を追加または廃止したら、`docs/engines/<engine>.md` の表と group 要約を同じ変更で更新する
