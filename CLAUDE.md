# configs

プロジェクト横断で使う共有設定の monorepo。npm パッケージとして publish する。

## 構成

- `packages/biome-config` - @yuu1111/biome-config (共有 Biome 設定)
- `packages/tsconfig` - @yuu1111/tsconfig (共有 TypeScript 設定)

## ツールチェーン

- パッケージマネージャ: Bun
- publish: npm publish
- バージョニング: npm version (手動)
- lint/format: Biome (self-hosting)

## コマンド

- `bun install` - 依存インストール + workspace リンク
- `bunx biome check .` - lint/format チェック
- `bunx biome check --write .` - 自動修正
- `npm version patch/minor/major` - バージョン更新 (各パッケージディレクトリで実行)

## 注意点

- Biome のネスト設定検出を避けるため、biome-config の設定ファイルは `shared.json` (not `biome.json`)
- root の devDependencies に `workspace:*` で自パッケージを参照 (シンボリックリンク用)
