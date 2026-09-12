[日本語](README.ja.md)

# @yuu1111/knip-config

Shared [Knip](https://knip.dev/) configuration.

## Install

```bash
bun add -D @yuu1111/knip-config knip
```

## Usage

Knip loads `knip.ts`, so import the preset that matches the project and add the project specific entries:

```ts
import { application } from "@yuu1111/knip-config/application"

export default {
	...application,
	entry: ["src/main.ts"]
}
```

A shared preset cannot infer dynamic entry points, CLI binaries, or generated files, so the project adds them.

`base` adds `quality.config.ts` as an entry point, but a project that writes its own `entry` replaces it, so list `quality.config.ts` too:

```ts
export default {
	...application,
	entry: ["src/main.ts", "quality.config.ts"]
}
```

A project with `workspaces` does not receive the top-level `entry` from `base` at the root workspace, so write it there too:

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
import { application } from "@yuu1111/knip-config/application"

export default {
	...application,
	ignore: ["another-project/**"]
}
```

## Presets

| Preset | Use case |
|--------|----------|
| `base` | Shared defaults |
| `application` | Applications whose entry points are resolved by a framework |
| `library` | Libraries whose entry points are their public API |

### base

- `ignoreExportsUsedInFile` keeps exports that are only referenced inside their own file out of the report
- `entry` treats `quality.config.ts`, which `quality-check` loads at run time, as an entry point: it is not reported as an unused file and the exports it imports count as used
- `ignoreIssues` keeps the exports of `quality.config.ts` itself out of the report, because the entry point of a consuming project is the API of `quality-check` and not the exports of this file

### application

- `includeEntryExports` stays off because the entry points of an application are not a public contract

### library

- `includeEntryExports` is on so an export that is no longer part of the public API is reported
