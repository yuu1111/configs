# configs

Shared configuration packages published to npm.

## Packages

| Package | Description |
|---------|-------------|
| [`@yuu1111/biome-config`](packages/biome-config) | Shared [Biome](https://biomejs.dev/) configuration |
| [`@yuu1111/tsconfig`](packages/tsconfig) | Shared TypeScript configurations |

## Development

Bun workspace monorepo. Biome is self-hosted (the repo lints itself with its own config).

```bash
bun install            # install + link workspaces
bunx biome check .     # lint / format check
bunx biome check --write .   # auto-fix
```

## Release

Versioning is manual via `npm version` inside each package, then `npm publish`.

```bash
cd packages/biome-config
npm version patch
npm publish
```

## Notes

- The biome-config preset filename is `base.json` / `react.json` (not `biome.json`) to avoid Biome's nested-config detection.
- The root `devDependencies` reference the workspace packages with `workspace:*` so the repo dogfoods its own configs via symlinks.

## License

MIT
