[日本語](README.ja.md)

# @yuu1111/quality-check

Runs Biome, the type checker, Knip, comment-check, document-style-check, and the
TSDoc checker from one CLI instead of one script per project. The baseline diff
lives here too.

## Install

```bash
bun add -D @yuu1111/quality-check
```

## Usage

Declare the engines to run and the conditions of each engine in
`quality.config.ts`, then call the CLI from a script:

```json
{
  "scripts": {
    "check:quality": "quality-check"
  }
}
```

```ts
import { defineConfig } from "@yuu1111/quality-check";

export default defineConfig({
	engines: {
		biome: true,
		typecheck: true,
		knip: true,
		"comment-check": true,
		"document-style-check": true,
		"tsdoc-check": true,
	},
	config: {
		"comment-check": { ignore: ["another-project"] },
		"tsdoc-check": { error: ["missing-doc"] },
	},
});
```

Each engine prints its own section, and the summary names the engines that
failed:

```text
== biome ==
Checked 128 files in 260ms. No fixes applied.
biome: passed (exit 0)

== comment-check ==
src/queue.ts:18:2 placeholder-comment placeholder comment should be resolved or tracked
comment-check: failed (1 new, 0 resolved, 0 warnings)

quality-check: 1 of 3 engines failed
  failed: comment-check
  passed: biome, tsdoc-check
```

## Config

| Field | Description |
|-------|-------------|
| `engines` | Engines to run, as `true` or `false` |
| `config` | Conditions of each engine |
| `baseline` | Baseline file path; `false` disables the diff |

Engines run in the order `biome`, `typecheck`, `knip`, `comment-check`,
`document-style-check`, `tsdoc-check`.

`engines` only delegates the start-up, and the conditions belong under the
engine in `config`. Each engine runs:

| Engine | Command | Conditions |
|--------|---------|------------|
| `biome` | `biome check` | `targets`, `args`; `biome.json` holds the excluded paths |
| `typecheck` | `tsc --noEmit` | `args`, `projects`; `tsconfig.json` holds the settings |
| `knip` | `knip` | `args`; `knip.ts` holds the settings |
| `comment-check` | `comment-check --json` | `ignore`, `targets`, `args` |
| `document-style-check` | `document-style-check lint --json` | `ignore`, `targets`, `args` |
| `tsdoc-check` | `tsdoc-check --json` | `ignore`, `targets`, `args`, `error` (rule names to fail on) |

`args` is appended after the engine defaults, for conditions the config cannot
express and for the case where an engine changes its arguments.

## Options

| Option | Description |
|--------|-------------|
| `--config <path>` | Config file to load (default `quality.config.ts`) |
| `--baseline <path>` | Override the baseline file |
| `--ignore <path>` | Add an excluded path, repeatable |
| `--update-baseline` | Replace the baseline with the current findings |
| `--json` | Print the per-engine results as JSON |

`--ignore` and the positional targets reach only the engines that take them.

## Notes

Exit code 0 means every engine passed, 1 that at least one failed, and 2 that the
configuration or an engine could not start.

Color is added only when stdout is a terminal. `NO_COLOR` turns it off and
`FORCE_COLOR` turns it on; the `--json` output stays plain.

The engines that can color their own output receive the same permission: Biome
gets `--colors=force` and tsc gets `--pretty`.

A condition that an engine does not take is not passed on, and the section says
so:

```text
== biome ==
biome: ignore skipped (biome.json holds its settings)
```

Biome, the type checker, and Knip keep their settings in `biome.json`,
`tsconfig.json`, and `knip.ts`. This CLI starts the engines from one file and
aggregates the results.

An engine binary is resolved at run time from the `node_modules/.bin` of the
project. A project that never calls an engine from its own scripts therefore
sees Knip report `@yuu1111/comment-check` and its siblings as unused
dependencies, so it declares them in `ignoreDependencies` with the reason.

`comment-check` runs with an unwritten baseline path so that it reports every
finding. The new-and-resolved diff is done by this CLI from a single baseline
file, so an existing `comment-baseline.json` is moved over with
`--update-baseline`.

`typecheck` starts `tsc --noEmit -p <path>` once per path in `projects`. Without
it the current `tsconfig.json` is read once, and `args` are added to every
start.
