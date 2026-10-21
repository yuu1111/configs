# configs

プロジェクト横断で使う共有設定の monorepo
npm パッケージとして publish する

## 構成

### config

- `packages/config/biome-config` - @yuu1111/biome-config (共有 Biome 設定)
- `packages/config/tsconfig` - @yuu1111/tsconfig (共有 TypeScript 設定)
- `packages/config/knip-config` - @yuu1111/knip-config (共有 Knip 設定)

### quality-check

検査engineのpackageは `packages/quality-check` (@yuu1111/quality-check) だけにし、4つのengineと共通処理を内部moduleとして置く
- `packages/quality-check/src/engines/code/` - 関数定義の間隔の検査 (`code`)
- `packages/quality-check/src/engines/comment/` - comment と抑制の検査 (`comment`)
- `packages/quality-check/src/engines/markdown/` - Markdownの機械的違反の検査と文体判断の検証記録 (`markdown`)
- `packages/quality-check/src/engines/tsdoc/` - TSDoc の構文と公開契約の検査 (`tsdoc`)
- `packages/quality-check/src/cli/` - routing、argv解析、コマンドの出力
- `packages/quality-check/src/config/` - 設定の型、既定値、解析、rule解決、読込、移行、schema
- `packages/quality-check/src/runner/` - engine実行、外部tool、baseline、検出の集約、対象fileの選択
- `packages/quality-check/src/engines/` - engineのcatalog、契約、登録、検出とreportの型、旧名の対応
- `packages/quality-check/src/utils/` - fileとJSONの低水準処理だけ

engineごとのdirectoryには実装を直接置き、さらに `src/` を挟まない
testsは `packages/quality-check/tests/{cli,config,runner,engines,utils,package}/` に責務を対応させて置き、tests直下にtest fileを置かない engineごとのtestsは `tests/engines/{code,comment,markdown,tsdoc}/` に置き、package整合性は [workspace-bins.test.ts](packages/quality-check/tests/package/workspace-bins.test.ts) で保つ

内部moduleはbarrelや再exportを作らず、所有moduleから直接importする configはrunnerとCLIへ依存せず、runnerはCLIへ依存しない enginesはrunner、CLI、設定parserへ依存しない CLIだけが各層を組み合わせる metadata catalogは設定parserを読み込まない

[src/cli.ts](packages/quality-check/src/cli.ts) は `run` をexportする薄いlauncherとし、routingは [cli/main.ts](packages/quality-check/src/cli/main.ts) に置く schemaの生成scriptはruntimeの外の [scripts/generate-schema.ts](packages/quality-check/scripts/generate-schema.ts) に置く

## パッケージと公開

- 共有設定は `packages/config/` にまとめ、統合CLIは `packages/quality-check/` に直接置く
- root の devDependencies に `workspace:*` で、root の script と設定 file が使う自パッケージを参照する (シンボリックリンク用)
- `quality-check` の build は `src/cli.ts` を依存込みで bundle し、公開 package に runtime dependency を持たせない
- 公開する check package の `bin` は commit した `bin/cli.js` を指し、そこで `dist/cli.js` の `run` を呼ぶ (Bun は install 時に target が存在しない workspace の `bin` を `node_modules/.bin` へ link しないため)
- workspace の `bin` を変えるときは `bun.lock` の workspaces entry も同じ変更で更新する (Bun は既存 lockfile の workspaces を再計算しないため)

## engine の規約

- engine をまたぐ契約 (engine 契約、rule 語彙、baseline、能力表) は `docs/engine-contract.md` を正本にする
- engine の rule 語彙は `quality-check/src/engines/<engine>/rule-ids.ts` へ `RULE_IDS` / `OPT_IN_RULE_IDS` / `RULE_GROUPS` / `FILE_EXTENSIONS` として置き、import を持たない内部moduleにする (rule ごとの option があれば `RULE_OPTIONS` も置く)
- 全 rule がいずれかの group へ重複なく入ることを tests で検査する
- engine の `run` `fix` `audit` の関数契約は内部moduleとして保ち、packageの公開subpath exportsにはしない 個別コマンドの argv 解析と出力は `quality-check` が持つ
- `quality-check` は検出engineの内部 `run` module を in-process で呼び、[src/engines/registry.ts](packages/quality-check/src/engines/registry.ts) の `FINDING_ENGINES` に登録する
- 外部engineの `biome`、`oxlint`、`oxfmt`、`typecheck`、`knip` は利用projectの `node_modules/.bin` から解決し、同梱せずbaselineの対象にしない
- 検出engineは baseline を持たず、新規と解消済みの判定は統合CLIが1つの baseline file で行う
- `markdown` の review ledger は `quality-check markdown <scan|check|lint>` として公開する
- `.grit` を追加したら `plugins-<layer>.json` へ列挙する (`custom-rules.test.ts` が一覧の一致を検査している)

## quality-check の設定

- 設定は `quality.json` だけにし、`$schema` が指す JSON Schema を `schema.json` として commit する (統合CLIは起動時に engine の内部 `rule-ids.ts` から同じ語彙を読む)
- engineごとのsectionに `rules` と `overrides` を置く `rules` は `preset`、group単位、rule単位の3段で書き、具体的な指定が勝つ rule名と group名は `rules` の直下へ並べる (group名とrule名は engine の `RULE_GROUPS` と `RULE_IDS` が唯一の出所)
- `overrides` は統合CLIが解き、fileごとの rule 選択を畳んでから engine を起動する (engine は `overrides` を知らない)
- `quality.json` の書式を破壊的に変えたら、`quality-check migrate` が旧書式を移せるようにする
- このリポジトリ自身を最厳格な利用例にするため、全 engine を有効にし、全 opt-in rule を有効にして warning は `error` へ上げる
- `first-line-heading` だけは、README と言語切替のリンクを1行目に置く規約と両立しないため切る
- `preset` でまとめて選ぶ形と `rules` で個別に選ぶ形の両方を見せ、rule名を手で並べる例は1 engine だけにする

## ツールチェーン

- パッケージマネージャ: Bun
- publish: GitHub Release から npm Trusted Publisher で自動実行
- バージョニング: `bun pm version`
- lint: Biome と Oxlint
- format: Biome と Oxfmt (OxfmtはYAMLだけを担当し、Biomeと対象を分ける)
- biome-config の設定ファイルは `base.json` / `react.json` (not `biome.json`) とし、Biome のネスト設定検出を避ける

## コマンド

- `bun install` - 依存インストール + workspace リンク
- `bun run build` - 内部engineと共通処理を依存込みで @yuu1111/quality-check へbundleする
- `bun run lint` - Biome と Oxlint のlintチェック
- `bun run format:check` - Biome と Oxfmt のformatチェック
- `bun run format` - Biome と Oxfmt の自動修正
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
- 同梱する内部engineは個別の README を持たず、設定とruleの正本を `docs/engines/<engine>.md` にする

## ドキュメントサイト

- VitePress で `docs/` と公開 package の README を1つの木から組み、`bun run docs:build` が `.vitepress/dist` を作る 配信は `.github/workflows/docs.yml` が GitHub Pages へ行う
- locale は日本語を既定にし英語を `/en/` に置く 翻訳は `docs/en/` へ同じ名前で置き、翻訳が無い文書の `en` は作らない
- 同じlocaleの文書へは兄弟の相対パスでリンクし、別localeの文書へは `../` で原稿の配置どおりにリンクする
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
  - 検出engineの場合は `quality-check` の `FINDING_ENGINES`
  - `docs/engines/<engine>.md` と root README の `## Documents`
  - README と設定表
- rule を追加または廃止したら、`docs/engines/<engine>.md` の表と group 要約を同じ変更で更新する
