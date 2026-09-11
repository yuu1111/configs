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

### application

- `includeEntryExports` stays off because the entry points of an application are not a public contract

### library

- `includeEntryExports` is on so an export that is no longer part of the public API is reported

## Notes

Dynamic entry points, CLI binaries, and generated files stay in the consuming
project because a shared preset cannot infer them from the project layout.
