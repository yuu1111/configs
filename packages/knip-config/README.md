[日本語](README.ja.md)

# @yuu1111/knip-config

Shared [Knip](https://knip.dev/) configuration.

## Install

```bash
bun add -D @yuu1111/knip-config knip
```

## Usage

Knip loads `knip.ts`, so import the preset that matches the project and add the
project specific entries:

```ts
import { application } from "@yuu1111/knip-config/application"

export default {
	...application,
	entry: ["src/main.ts"]
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

## Notes

Dynamic entry points, CLI binaries, and generated files stay in the consuming
project because a shared preset cannot infer them from the project layout.

The `entry` that `base` adds is replaced when a project writes its own `entry`,
so an added entry lists `quality.config.ts` as well:

```ts
export default {
	...application,
	entry: ["src/main.ts", "quality.config.ts"]
}
```

Writing `workspaces` in the config means the top-level `entry` that `base`
adds does not reach the root workspace, so the root workspace repeats it:

```ts
export default {
	...application,
	workspaces: {
		".": { entry: ["quality.config.ts"] },
		"packages/app": { entry: ["src/cli.ts"] }
	}
}
```

A repository that also holds another project keeps that project out of the
report with `ignore`, so its files are not read as source of the parent:

```ts
import { application } from "@yuu1111/knip-config/application"

export default {
	...application,
	ignore: ["another-project/**"]
}
```

Knip prints a configuration hint when a repository with `workspaces` writes
`entry` at the top level. A hint is not a report, so the exit code does not
change.
