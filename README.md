[日本語](README.ja.md)

# configs

Shared configuration packages published to npm.

## Packages

| Package | Description |
|---------|-------------|
| [`@yuu1111/biome-config`](packages/config/biome-config) | Shared [Biome](https://biomejs.dev/) configuration |
| [`@yuu1111/knip-config`](packages/config/knip-config) | Shared [Knip](https://knip.dev/) configuration |
| [`@yuu1111/quality-check`](packages/engine/quality-check) | Integrated CLI with the check engines built into it |
| [`@yuu1111/tsconfig`](packages/config/tsconfig) | Shared TypeScript configurations |

The individual check engines live under `packages/engine/` as private workspace packages and are bundled into `@yuu1111/quality-check`.

## Documents

- [Engine contract](docs/engine-contract.md) - the contract that the check engines and the integrated runner share

## Development

Bun workspace monorepo. Biome is self-hosted (the repo lints itself with its own config).

```bash
bun install            # install + link workspaces
bun run build          # bundle the check engines and their dependencies into @yuu1111/quality-check
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
