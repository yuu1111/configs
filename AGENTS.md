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
- `bun pm version patch/minor/major --no-git-tag-version` - バージョン更新 (各パッケージディレクトリで実行)

## ドキュメント

- packageのREADMEは `templates/package-readme.style.md` の記法に従い、`templates/package-readme.template.md` をひな形にする
- `README.md` を正本、`README.ja.md` を同じ見出し構成の日本語版として並べる

## 注意点

- package の配置は `packages/config/` (共有設定) と `packages/engine/` (検査engine) に分ける
- Biome のネスト設定検出を避けるため、biome-config の設定ファイルは `base.json` / `react.json` (not `biome.json`)
- root の devDependencies に `workspace:*` で自パッケージを参照 (シンボリックリンク用)
- check engine は @yuu1111/shared を build 時に bundle して配布する (shared は private なので publish しない)
- check package の `bin` は commit した `bin/cli.js` を指し、そこで `dist/cli.js` の `run` を呼ぶ (Bun は install 時に target が存在しない workspace の `bin` を `node_modules/.bin` へ link しないため)
- workspace の `bin` を変えるときは `bun.lock` の workspaces entry も同じ変更で更新する (Bun は既存 lockfile の workspaces を再計算しないため)
- GitHub Release tag は `biome-config-vX.Y.Z`、`code-style-check-vX.Y.Z`、`comment-check-vX.Y.Z`、`document-style-check-vX.Y.Z`、`knip-config-vX.Y.Z`、`quality-check-vX.Y.Z`、`tsdoc-check-vX.Y.Z`、または `tsconfig-vX.Y.Z`
- npm publish はローカルで実行せず、`.github/workflows/release.yml` に任せる
- バージョン更新は `bun pm version` を使う (npm version は workspace の reify でエラーになる)
