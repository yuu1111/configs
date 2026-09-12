[English](README.md)

# configs

npmへ公開する共有設定package

## Packages

| Package | Description |
|---------|-------------|
| [`@yuu1111/biome-config`](packages/config/biome-config) | 共有の [Biome](https://biomejs.dev/) 設定 |
| [`@yuu1111/comment-check`](packages/engine/comment-check) | baselineを持つcomment検査 |
| [`@yuu1111/document-style-check`](packages/engine/document-style-check) | 判断記録を持つMarkdown検査 |
| [`@yuu1111/knip-config`](packages/config/knip-config) | 共有の [Knip](https://knip.dev/) 設定 |
| [`@yuu1111/quality-check`](packages/engine/quality-check) | engineをまとめて起動する統合CLI |
| [`@yuu1111/tsconfig`](packages/config/tsconfig) | 共有のTypeScript設定 |
| [`@yuu1111/tsdoc-check`](packages/engine/tsdoc-check) | exported宣言のTSDoc検査 |

## Development

Bun workspaceのmonorepo Biomeは自分の設定で自分をlintするself-hosting

```bash
bun install            # install + link workspaces
bun run build          # 公開するcheck packageへ @yuu1111/shared を同梱する
bunx biome check .     # lint / format check
bunx biome check --write .   # auto-fix
```

## Release

公開はGitHub Releaseの作成時にnpm Trusted Publisher経由で走る 選んだpackageのversionと一致するpackage固有のtagを使う

```bash
cd packages/config/biome-config
npm version patch --no-git-tag-version
# Commit and push the version change, then publish biome-config-vX.Y.Z on GitHub.
```

`@yuu1111/biome-config` は `biome-config-vX.Y.Z`、`@yuu1111/tsconfig` は `tsconfig-vX.Y.Z` を使う ローカルで `npm publish` は実行しない

## Notes

- biome-configのpreset file名は `base.json` / `react.json` にし、Biomeのnested config検出を避けるため `biome.json` にはしない
- ルートの `devDependencies` はworkspace packageを `workspace:*` で参照し、symlink経由で自分の設定をdogfoodする
- `@yuu1111/shared` はprivateにし、公開するcheck packageへbuild時に同梱する 公開物にruntime依存として残さない
- 各check packageはcommit済みの `bin/cli.js` からbuild成果物の `dist/cli.js` を呼ぶ Bunはinstall時にtargetが存在するworkspaceの `bin` だけを `node_modules/.bin` へlinkするため、build成果物を直接 `bin` に指定するとclean cloneの初回installでCLIが見つからない
- `bun.lock` はworkspaceの `bin` を保持し、Bunは後のinstallで再計算しない `bin` は `package.json` と `bun.lock` を同じ変更で更新し、`--frozen-lockfile` のinstallでもcommandをlinkできるようにする
