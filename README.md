[日本語](README.ja.md)

# configs

Shared configuration packages published to npm.

## Packages

| Package | Description |
|---------|-------------|
| [`@yuu1111/biome-config`](packages/biome-config) | Shared [Biome](https://biomejs.dev/) configuration |
| [`@yuu1111/comment-check`](packages/comment-check) | Comment checker with a baseline |
| [`@yuu1111/document-style-check`](packages/document-style-check) | Markdown checker with a review ledger |
| [`@yuu1111/knip-config`](packages/knip-config) | Shared [Knip](https://knip.dev/) configuration |
| [`@yuu1111/quality-check`](packages/quality-check) | Integrated CLI that runs the quality engines |
| [`@yuu1111/tsconfig`](packages/tsconfig) | Shared TypeScript configurations |
| [`@yuu1111/tsdoc-check`](packages/tsdoc-check) | TSDoc checker for exported declarations |

## Development

Bun workspace monorepo. Biome is self-hosted (the repo lints itself with its own config).

```bash
bun install            # install + link workspaces
bun run build          # bundle @yuu1111/shared into the published check packages
bunx biome check .     # lint / format check
bunx biome check --write .   # auto-fix
```

## Release

Publishing runs through npm Trusted Publisher when a GitHub Release is published.
Use a package-specific tag whose version matches the selected package.

```bash
cd packages/biome-config
npm version patch --no-git-tag-version
# Commit and push the version change, then publish biome-config-vX.Y.Z on GitHub.
```

Use `biome-config-vX.Y.Z` for `@yuu1111/biome-config` and
`tsconfig-vX.Y.Z` for `@yuu1111/tsconfig`. Do not run `npm publish` locally.

## Notes

- The biome-config preset filename is `base.json` / `react.json` (not `biome.json`) to avoid Biome's nested-config detection.
- The root `devDependencies` reference the workspace packages with `workspace:*` so the repo dogfoods its own configs via symlinks.
- `@yuu1111/shared` is private and its code is bundled into each check package at build time, so the published packages have no runtime dependency on it.
