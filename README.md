[日本語](README.ja.md)

# configs

Shared configuration packages published to npm.

## Packages

| Package | Description |
|---------|-------------|
| [`@yuu1111/biome-config`](packages/config/biome-config) | Shared [Biome](https://biomejs.dev/) configuration |
| [`@yuu1111/code-style-check`](packages/engine/code-style-check) | Function spacing checker |
| [`@yuu1111/comment-check`](packages/engine/comment-check) | Comment and suppression checker |
| [`@yuu1111/document-style-check`](packages/engine/document-style-check) | Markdown checker with a review ledger |
| [`@yuu1111/knip-config`](packages/config/knip-config) | Shared [Knip](https://knip.dev/) configuration |
| [`@yuu1111/quality-check`](packages/engine/quality-check) | Integrated CLI that runs the quality engines |
| [`@yuu1111/tsconfig`](packages/config/tsconfig) | Shared TypeScript configurations |
| [`@yuu1111/tsdoc-check`](packages/engine/tsdoc-check) | TSDoc checker for exported declarations |

## Documents

- [Engine contract](docs/engine-contract.md) - the contract that the check engines and the integrated CLI share

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
cd packages/config/biome-config
bun pm version patch --no-git-tag-version
# Commit and push the version change, then publish biome-config-vX.Y.Z on GitHub.
```

Use `biome-config-vX.Y.Z` for `@yuu1111/biome-config` and `tsconfig-vX.Y.Z` for `@yuu1111/tsconfig`.
Do not run `npm publish` locally.
