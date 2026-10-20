[日本語](README.ja.md)

# configs

Shared configuration and check packages published to npm.

## Packages

| Package | Description |
|---------|-------------|
| [`@yuu1111/biome-config`](packages/config/biome-config/README.md) | Shared [Biome](https://biomejs.dev/) configuration |
| [`@yuu1111/knip-config`](packages/config/knip-config/README.md) | Shared [Knip](https://knip.dev/) configuration |
| [`@yuu1111/quality-check`](packages/engine/quality-check/README.md) | Integrated CLI with the check engines built into it |
| [`@yuu1111/tsconfig`](packages/config/tsconfig/README.md) | Shared TypeScript configurations |

The individual check engines `code-style-check`, `comment-check`, `document-style-check`, and `tsdoc-check` live under `packages/engine/` as private workspace packages and are bundled into `@yuu1111/quality-check`, together with `@yuu1111/shared`.

## Documents

| Document | Purpose |
|----------|---------|
| [Architecture](docs/architecture.md) | Why the packages are layered and bundled the way they are |
| [Adoption](docs/adoption.md) | Installing the packages into a project, from config to CI |
| [Engine contract](docs/engine-contract.md) | The contract the built-in engines and the integrated runner share |
| [Engine reference](docs/engines/index.md) | The external and built-in engines |
| [Oxlint](docs/engines/oxlint.md) | External lint engine and command-line integration |
| [Oxfmt](docs/engines/oxfmt.md) | Read-only format checks and file selection |

## Development

Bun workspace monorepo. Biome uses its own shared config, Oxlint adds lint checks, and Oxfmt formats YAML only to avoid conflicting with Biome.

```bash
bun install            # install + link workspaces
bun run build          # bundle the check engines and their dependencies into @yuu1111/quality-check
bun run lint           # Biome + Oxlint
bun run format:check   # Biome + Oxfmt
bun run format         # auto-fix with Biome + Oxfmt
```

## Release

Publishing runs through npm Trusted Publisher when a GitHub Release is published.
Use a package-specific tag whose version matches the selected package.

```bash
cd packages/config/biome-config
bun pm version patch --no-git-tag-version
# Commit and push the version change, then publish biome-config-vX.Y.Z on GitHub.
```

Name the tag after the package being released, for example `biome-config-vX.Y.Z`.
Do not run `npm publish` locally.
