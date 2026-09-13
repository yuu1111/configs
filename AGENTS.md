# configs

プロジェクト横断で使う共有設定の monorepo
npm パッケージとして publish する

## 構成

### config

- `packages/config/biome-config` - @yuu1111/biome-config (共有 Biome 設定)
- `packages/config/tsconfig` - @yuu1111/tsconfig (共有 TypeScript 設定)
- `packages/config/knip-config` - @yuu1111/knip-config (共有 Knip 設定)

### engine

- `packages/engine/code-style-check` - @yuu1111/code-style-check (関数定義の間隔の検査)
- `packages/engine/comment-check` - @yuu1111/comment-check (comment と抑制の検査)
- `packages/engine/document-style-check` - @yuu1111/document-style-check (Markdownの機械的違反の検査と文体判断の検証記録)
- `packages/engine/tsdoc-check` - @yuu1111/tsdoc-check (TSDoc の構文と公開契約の検査)
- `packages/engine/quality-check` - @yuu1111/quality-check (engine 起動と baseline の統合 CLI)
- `packages/engine/shared` - @yuu1111/shared (検査engineの共通処理、privateでpublishしない)

## ツールチェーン

- パッケージマネージャ: Bun
- publish: GitHub Release から npm Trusted Publisher で自動実行
- バージョニング: bun pm version (packageごとに手動)
- lint/format: Biome (self-hosting)

## コマンド

- `bun install` - 依存インストール + workspace リンク
- `bun run build` - 公開する check package へ @yuu1111/shared を同梱する
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
- このリポジトリ自身を最厳格な利用例にするため、`quality.config.ts` で全 engine を有効にし、全 opt-in rule を有効にして warning は `error` へ上げる (まとめて選ぶpresetと個別に選ぶ `rules` の両方を見せ、rule名を手で並べるのは例に出す1 engineだけにする)
- Biome のネスト設定検出を避けるため、biome-config の設定ファイルは `base.json` / `react.json` (not `biome.json`)
- root の devDependencies に `workspace:*` で自パッケージを参照 (シンボリックリンク用)
- check engine は @yuu1111/shared を build 時に bundle して配布する (shared は private なので publish しない)
- engine の rule 語彙は engine の `src/rule-ids.ts` へ置き、import を持たせず `./rule-ids` として公開する (公開する型を private な @yuu1111/shared へ依存させないため)
- `quality-check` の `rules` は engine が公開する union を type import し、presetの展開と `off` の検証は実行時に engine の `./rule-ids` を読むため 3 engine を `peerDependencies` に持つ (型は導入された engine から来るため範囲は下限だけの `>=` で示す)
- `quality-check` の build は 3 engine の `./rule-ids` を `--external` にし、rule語彙を実行時に導入済みengineから読む (bundleすると古い一覧が焼き込まれる)
- check package の `bin` は commit した `bin/cli.js` を指し、そこで `dist/cli.js` の `run` を呼ぶ (Bun は install 時に target が存在しない workspace の `bin` を `node_modules/.bin` へ link しないため)
- workspace の `bin` を変えるときは `bun.lock` の workspaces entry も同じ変更で更新する (Bun は既存 lockfile の workspaces を再計算しないため)
- GitHub Release tag は `biome-config-vX.Y.Z`、`code-style-check-vX.Y.Z`、`comment-check-vX.Y.Z`、`document-style-check-vX.Y.Z`、`knip-config-vX.Y.Z`、`quality-check-vX.Y.Z`、`tsdoc-check-vX.Y.Z`、または `tsconfig-vX.Y.Z`
- npm publish はローカルで実行せず、`.github/workflows/release.yml` に任せる
- バージョン更新は `bun pm version` を使う (npm version は workspace の reify でエラーになる)
- package を追加したら、次のすべてを同じ変更で更新する: root の `README.md` と `README.ja.md` の表、この `AGENTS.md` の構成、Release tag の一覧、root の `devDependencies` の `workspace:*`、`.github/workflows/release.yml` のtag pattern
- engine を追加したら、`quality-check` の `ENGINE_NAMES`、README、設定表を同じ変更で更新する
- `.grit` を追加したら `plugins-<layer>.json` へ列挙する (`custom-rules.test.ts` が一覧の一致を検査している)
