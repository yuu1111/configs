[English](README.md)

# configs

npmへ公開する共有設定package

## Packages

| Package | Description |
|---------|-------------|
| [`@yuu1111/biome-config`](packages/config/biome-config) | 共有の [Biome](https://biomejs.dev/) 設定 |
| [`@yuu1111/code-style-check`](packages/engine/code-style-check) | 関数定義の間隔の検査 |
| [`@yuu1111/comment-check`](packages/engine/comment-check) | commentと抑制commentの検査 |
| [`@yuu1111/document-style-check`](packages/engine/document-style-check) | 判断記録を持つMarkdown検査 |
| [`@yuu1111/knip-config`](packages/config/knip-config) | 共有の [Knip](https://knip.dev/) 設定 |
| [`@yuu1111/quality-check`](packages/engine/quality-check) | engineをまとめて起動する統合CLI |
| [`@yuu1111/tsconfig`](packages/config/tsconfig) | 共有のTypeScript設定 |
| [`@yuu1111/tsdoc-check`](packages/engine/tsdoc-check) | exported宣言のTSDoc検査 |

## Documents

- [engine の共通規約](docs/engine-contract.md) - 検査engineと統合CLIの間で守る契約

## Development

Bun workspaceのmonorepo Biomeは自分の設定で自分をlintするself-hosting

```bash
bun install            # install + link workspaces
bun run build          # 公開するcheck packageへ @yuu1111/shared を同梱する
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

`@yuu1111/biome-config` は `biome-config-vX.Y.Z`、`@yuu1111/tsconfig` は `tsconfig-vX.Y.Z` を使う
ローカルで `npm publish` は実行しない
