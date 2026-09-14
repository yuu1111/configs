[English](README.md)

# configs

npmへ公開する共有設定と検査package

## Packages

| Package | Description |
|---------|-------------|
| [`@yuu1111/biome-config`](packages/config/biome-config) | 共有の [Biome](https://biomejs.dev/) 設定 |
| [`@yuu1111/knip-config`](packages/config/knip-config) | 共有の [Knip](https://knip.dev/) 設定 |
| [`@yuu1111/quality-check`](packages/engine/quality-check) | 検査engineを同梱する統合CLI |
| [`@yuu1111/tsconfig`](packages/config/tsconfig) | 共有のTypeScript設定 |

個別の検査engine `code-style-check`、`comment-check`、`document-style-check`、`tsdoc-check` は `packages/engine/` 配下のprivateなworkspace packageとして置き、`@yuu1111/shared` とともに `@yuu1111/quality-check` へ同梱する

## Documents

| 文書 | 用途 |
|------|------|
| [構成と設計判断](docs/architecture.md) | packageの層と同梱の理由 |
| [プロジェクトへの導入](docs/adoption.md) | 設定からCIまでの導入手順 |
| [engine の共通規約](docs/engine-contract.md) | 検査engineと統合runnerの間で守る契約 |
| [engine 一覧](docs/engines/) | 検査engineの設定とruleの正本 |

## Development

Bun workspaceのmonorepo Biomeは自分の設定で自分をlintするself-hosting

```bash
bun install            # install + link workspaces
bun run build          # 検査engineとその依存を @yuu1111/quality-check へ同梱する
bunx biome check .     # lint / format check
bunx biome check --write .   # auto-fix
```

## Release

公開はGitHub Releaseの作成時にnpm Trusted Publisher経由で走る
選んだpackageのversionと一致するpackage固有のtagを使う

```bash
cd packages/config/biome-config
bun pm version patch --no-git-tag-version
# Commit and push the version change, then publish biome-config-vX.Y.Z on GitHub.
```

tagは公開するpackageの名前に合わせ、例えば `biome-config-vX.Y.Z` にする
ローカルで `npm publish` は実行しない
