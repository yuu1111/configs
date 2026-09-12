[English](README.md)

# configs

npmへ公開する共有設定package

## Packages

| Package | Description |
|---------|-------------|
| [`@yuu1111/biome-config`](packages/biome-config) | 共有の [Biome](https://biomejs.dev/) 設定 |
| [`@yuu1111/comment-check`](packages/comment-check) | baselineを持つcomment検査 |
| [`@yuu1111/knip-config`](packages/knip-config) | 共有の [Knip](https://knip.dev/) 設定 |
| [`@yuu1111/tsconfig`](packages/tsconfig) | 共有のTypeScript設定 |
| [`@yuu1111/tsdoc-check`](packages/tsdoc-check) | exported宣言のTSDoc検査 |

## Development

Bun workspaceのmonorepo Biomeは自分の設定で自分をlintするself-hosting

```bash
bun install            # install + link workspaces
bunx biome check .     # lint / format check
bunx biome check --write .   # auto-fix
```

## Release

公開はGitHub Releaseの作成時にnpm Trusted Publisher経由で走る 選んだpackageのversionと一致するpackage固有のtagを使う

```bash
cd packages/biome-config
npm version patch --no-git-tag-version
# Commit and push the version change, then publish biome-config-vX.Y.Z on GitHub.
```

`@yuu1111/biome-config` は `biome-config-vX.Y.Z`、`@yuu1111/tsconfig` は `tsconfig-vX.Y.Z` を使う ローカルで `npm publish` は実行しない

## Notes

- biome-configのpreset file名は `base.json` / `react.json` にし、Biomeのnested config検出を避けるため `biome.json` にはしない
- ルートの `devDependencies` はworkspace packageを `workspace:*` で参照し、symlink経由で自分の設定をdogfoodする

## License

MIT
