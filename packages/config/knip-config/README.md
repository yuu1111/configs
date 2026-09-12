[日本語](README.ja.md)

# @yuu1111/knip-config

Shared [Knip](https://knip.dev/) configuration.

## Install

```bash
bun add -D @yuu1111/knip-config knip
```

## Usage

Knip loads `knip.ts`, so import the preset that matches the project and add the entries it cannot infer:

```ts
import { application } from "@yuu1111/knip-config/application"

export default {
	...application,
	entry: ["src/main.ts"]
}
```

## Presets

| Preset | `includeEntryExports` | Use case |
|--------|----------------------|----------|
| `base` | — | Shared defaults |
| `application` | `false` | Applications whose entry points a framework resolves |
| `library` | `true` | Libraries whose entry points are their public API |

### base

Every preset extends `base`.

| Setting | Value |
|---------|-------|
| `entry` | `["quality.config.ts"]` |
| `ignoreExportsUsedInFile` | `true` |
| `ignoreIssues` | `{"quality.config.ts": ["exports"]}` |

`quality-check` loads `quality.config.ts` at run time, so the file counts as an entry point and is not reported as unused.
`ignoreIssues` keeps its exports out of the report, because the public API of a consuming project is the API of `quality-check` and not the exports of this file.

### application

Sets `includeEntryExports: false`, because the entry points of an application are not a public contract.

### library

Sets `includeEntryExports: true`, so an export that is no longer part of the public API is reported.

## Config

A shared preset cannot see dynamic entry points, CLI binaries, or generated files, so the project adds them.

`entry` is replaced when the project writes its own, so list `quality.config.ts` too:

```ts
export default {
	...application,
	entry: ["src/main.ts", "quality.config.ts"]
}
```

`workspaces` does not inherit the top-level `entry` in the root workspace, so write it there too:

```ts
export default {
	...application,
	workspaces: {
		".": { entry: ["quality.config.ts"] },
		"packages/app": { entry: ["src/cli.ts"] }
	}
}
```

Knip prints a configuration hint when a repository with `workspaces` also writes `entry` at the top level.
A hint is not a report, so the exit code does not change.

A repository that also holds another project keeps it out of the report with `ignore`, so its files are not read as source of the parent:

```ts
export default {
	...application,
	ignore: ["another-project/**"]
}
```
