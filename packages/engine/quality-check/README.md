[日本語](README.ja.md)

# @yuu1111/quality-check

Runs Biome, the type checker, Knip, code-style-check, comment-check,
document-style-check, and the TSDoc checker from one CLI instead of one script per project.
The baseline diff lives here too.

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
		"code-style-check": true,
		"comment-check": true,
		"document-style-check": true,
		"tsdoc-check": true,
	},
	config: {
		"comment-check": {
			enable: ["japanese-period"],
			ignore: ["another-project"],
		},
		"document-style-check": {
			enable: ["japanese-period"],
		},
		"tsdoc-check": {
			error: ["missing-doc"],
		},
	},
});
```

Each engine prints its own section with its own time, and the summary names
the engines that failed and the total time the run took:

```text
== biome ==
Checked 128 files in 260ms. No fixes applied.
biome: passed (exit 0, 296ms)

== comment-check ==
src/queue.ts:18:2 placeholder-comment placeholder comment should be resolved or tracked
comment-check: failed (1 new, 0 resolved, 0 warnings, 118ms)

quality-check: 1 of 3 engines failed (1250ms)
  failed: comment-check
  passed: biome, tsdoc-check
```

## Config

| Field | Description |
|-------|-------------|
| `engines` | Engines to run, as `true` or `false` |
| `config` | Conditions of each engine |
| `baseline` | Baseline file path; `false` disables the diff |

Engines run in the order `biome`, `typecheck`, `knip`, `code-style-check`,
`comment-check`, `document-style-check`, `tsdoc-check`.

`engines` only delegates the start-up, and the conditions belong under the
engine in `config`. Write an engine's conditions as a multi-line object, so a
new rule or option changes one engine's block alone. Each engine runs:

| Engine | Command | Conditions |
|--------|---------|------------|
| `biome` | `biome check` | `targets`, `args`; `biome.json` holds the excluded paths |
| `typecheck` | `tsc --noEmit` | `args`, `projects`; `tsconfig.json` holds the settings |
| `knip` | `knip` | `args`; `knip.ts` holds the settings |
| `code-style-check` | `code-style-check --json` | `ignore`, `targets`, `args` |
| `comment-check` | `comment-check --json` | `ignore`, `targets`, `args`, `enable` (rule names to turn on) |
| `document-style-check` | `document-style-check lint --json` | `ignore`, `targets`, `args`, `enable` (rule names to turn on) |
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

An engine's time covers its start-up through reading its results, and the status
line carries it. An engine that never started, such as one that is not
installed, has no time.

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

`enable` names the opt-in rules of `comment-check` and `document-style-check`
and becomes `--enable <rule>` on each of their commands. The other engines
reject the field, and the default rule set stays as it is. This CLI ships no
engine of its own, so a project that turns an opt-in rule on updates the
matching engine package in the same change.

`typecheck` starts `tsc --noEmit -p <path>` once per path in `projects`. Without
it the current `tsconfig.json` is read once, and `args` are added to every
start.
