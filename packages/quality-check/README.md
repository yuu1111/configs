[日本語](README.ja.md)

# @yuu1111/quality-check

Integrated CLI that runs the configured engines and owns the baseline diff.

## Install

```bash
bun add -D @yuu1111/quality-check
```

The four finding engines `code`, `comment`, `markdown`, and `tsdoc` are built into this package.
`bun build` bundles the internal engine modules, shared code, and their dependencies into `dist/cli.js`, leaving the published package without runtime dependencies. No separate engine package has to be installed or resolved at run time. The repository separates CLI, config, runner, engine contracts, and low-level utilities; see the [architecture](../../docs/architecture.md) for source responsibilities and dependency boundaries.
Biome, Oxlint, Oxfmt, `tsc` or Bun, and Knip run as child processes and resolve from the project's `node_modules/.bin` and those of its parents.
Bun also falls back to `PATH` after these directories.
Install the tools you enable as devDependencies of the consuming project; they are not bundled.

## Usage

Declare the engines to run in `quality.json`, then call the CLI from a script:

```json
{
	"scripts": {
		"check:quality": "quality-check"
	}
}
```

```json
{
	"$schema": "./node_modules/@yuu1111/quality-check/schema.json",
	"failOnWarnings": true,
	"biome": true,
	"oxlint": true,
	"oxfmt": true,
	"comment": {
		"includes": [
			"**",
			"!another-project/**"
		],
		"rules": {
			"japanese-period": "on"
		}
	},
	"markdown": {
		"rules": {
			"preset": "all"
		}
	},
	"tsdoc": {
		"rules": {
			"preset": "all"
		},
		"overrides": [
			{
				"files": [
					"tests/**"
				],
				"rules": {
					"missing-doc": "off"
				}
			}
		]
	}
}
```

Each engine prints its own section with its own time, and the summary names the engines that failed and the total time the run took:

```text
== biome ==
Checked 128 files in 260ms. No fixes applied.
biome: passed (exit 0, 296ms)

== comment ==
src/queue.ts:18:2 placeholder-comment placeholder comment should be resolved or tracked
comment: failed (1 new, 0 resolved, 0 warnings, 118ms)

quality-check: 1 of 3 engines failed (1250ms)
  failed: comment
  passed: biome, tsdoc
```

Exit code 0 means every engine passed, 1 that at least one failed, and 2 that the configuration or an engine could not start.

Pass engine names to run only those engines:

```bash
quality-check biome knip
quality-check comment docs
quality-check markdown
quality-check markdown docs
```

Positional arguments that match an engine name select engines and the rest are target paths.
`--update-baseline` always runs every enabled engine, so combining it with an engine selection is rejected.
A path that matches an engine name needs a `./` prefix, as in `quality-check ./biome`.

## Config

| Field                | Description                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| `<engine>`           | One section per engine; writing `true` or a section starts it, and `false` or `enabled: false` stops it |
| `<engine>.includes`  | Globs inspected by the four built-in finding engines                                                    |
| `<engine>.rules`     | Rule selection of the four built-in finding engines                                                     |
| `<engine>.overrides` | Rule selection layered onto the files its globs select                                                  |
| `failOnWarnings`     | Treat warnings as blocking findings and apply the same policy to Biome and Oxlint                       |
| `baseline`           | Baseline file path; `false` disables the diff                                                           |
| `typecheck.tool`     | `"tsc"` (default) or `"bun"`; selects the type checker                                                  |

Engines run in the order `biome`, `oxlint`, `oxfmt`, `typecheck`, `knip`, `code`, `comment`, `markdown`, `tsdoc`.

Each engine owns a top-level section that holds the conditions that engine takes.
A section that is present starts the engine, and an engine without conditions can be written as just `true`, as in `"biome": true`.
`false` or `enabled: false` stops it.
A condition an engine does not take is rejected, so a typo fails at start-up instead of being ignored.
`biome`, `oxlint`, `oxfmt`, `typecheck`, and `knip` run as child processes, and the four finding engines run in-process.

| Engine      | Command                                 | Conditions                                                                          |
| ----------- | --------------------------------------- | ----------------------------------------------------------------------------------- |
| `biome`     | `biome check`                           | `args`; `biome.json` selects the files                                              |
| `oxlint`    | `oxlint`                                | `args`; accepts targets and `--ignore`                                              |
| `oxfmt`     | `oxfmt --check`                         | `args`; accepts targets, skips `--ignore`                                           |
| `typecheck` | `tsc --noEmit` (default) or `bun check` | `tool` (`"tsc"` or `"bun"`), `args`, `projects`; `tsconfig.json` holds the settings |
| `knip`      | `knip`                                  | `args`; `knip.ts` holds the settings                                                |
| `code`      | in-process                              | `includes`, `rules`, `overrides`                                                    |
| `comment`   | in-process                              | `includes`, `rules`, `overrides`                                                    |
| `markdown`  | in-process                              | `includes`, `rules`, `overrides`                                                    |
| `tsdoc`     | in-process                              | `includes`, `rules`, `overrides`                                                    |

`args` applies only to the child-process engines and is appended after the engine defaults, for conditions the config cannot express and for the case where an engine changes its arguments.
When `failOnWarnings` is true, the runner passes `--error-on-warnings` to Biome and `--deny-warnings` to Oxlint automatically.
Oxlint runs as `oxlint [targets] [args]` and converts each `--ignore` into `--ignore-pattern <ignore>`.
Oxfmt runs as `oxfmt --check [targets] [args]`, so the default run checks formatting without writing files.
Oxfmt skips `--ignore` with a message; its `.oxfmtrc.json` and ignore files select exclusions.
When using both Biome and Oxfmt, keep their formatting targets separate; this repo uses Oxfmt for YAML only.
These external engines are not part of the baseline; their exit codes determine their results.

`includes` selects paths relative to the project root with globs.
It defaults to `**`, while an empty array inspects nothing.
A negative glob excludes files selected earlier, and a later positive glob can include them again, so order matters.

A command line override an engine does not take is not passed on, and the section says so:

```text
== biome ==
biome: ignore skipped (biome.json holds its settings)
```

`rules` selects which rules of the built-in engines run and how they are reported.
`rules.preset` selects in bulk: `recommended` is the engine default, `all` turns every rule on, and `none` turns every rule off.
Rule names and group names sit side by side directly under `rules`.
A rule key applies to that rule alone, and a group key names one of the rule groups the engine publishes and applies to every rule in that group, each taking `off`, `on`, `warn`, or `error`.
A per-rule option travels in an object, as in `{ "level": "on", "options": { "scope": "documented" } }`.
Leaving `level` out keeps the state of the rule and only layers the option, and an option given to a group reaches only the rules that take it.
The most specific setting wins whatever order the keys are written in, so a preset, a group, and a rule layer in that order.
`off` also works for a rule that is on by default, and `on` keeps the engine default severity.
`warn` and `error` change the severity in every finding engine and turn an opt-in rule on first.
A group or rule name that the engine does not know, or an option that the rule does not take, is a configuration error, and the published `schema.json` teaches an editor the same vocabulary.
The selection is handed to the built-in engines directly, so the CLI no longer turns it into `--enable`, `--disable`, or `--error` arguments.

### overrides

`overrides` layers `rules` onto the files its globs select.
`files` takes the same globs as `includes`, negative globs included.
`rules` has the same shape as the top-level `rules`; entries apply in the order written, and a later one wins.

```json
{
	"tsdoc": {
		"rules": {
			"preset": "all"
		},
		"overrides": [
			{
				"files": [
					"tests/**"
				],
				"rules": {
					"missing-doc": "off"
				}
			},
			{
				"files": [
					"src/legacy/**"
				],
				"rules": {
					"completeness": "warn"
				}
			}
		]
	}
}
```

Only the files `includes` selects are inspected, and `overrides` adds none.
The overrides fold into a rule selection per file before a finding engine starts, and files that end up with the same selection share one run.

No check engine keeps a baseline of its own, so the new-and-resolved diff is done by this CLI from a single baseline file.

`typecheck.tool` selects `"tsc"` (default, `tsc --noEmit`) or `"bun"` ([`bun check`](https://bun.com/docs/runtime/check)).
For each tsconfig in `projects`, the runner starts the selected command with `--project <path>`, then appends `args` at the end.
Omitting `projects` runs the command once for the current `tsconfig.json`.
For example, select Bun in `quality.json`:

```json
{
	"typecheck": {
		"tool": "bun",
		"projects": [
			"tsconfig.json"
		],
		"args": [
			"--pretty",
			"false"
		]
	}
}
```

## Rules

The external engines have separate references for [Oxlint](../../docs/engines/oxlint.md) and [Oxfmt](../../docs/engines/oxfmt.md).
Their rules and formatting settings stay in their own configuration files, not in `quality.json.rules`.

Each built-in engine defines its rule vocabulary in an import-free internal `rule-ids.ts` module, not a public package subpath export. One document holds the options and rules of each engine:

| Engine     | Groups                                                       | Reference                                                    |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `code`     | `spacing`                                                    | [`docs/engines/code.md`](../../docs/engines/code.md)         |
| `comment`  | `suppression`, `shape`, `content`                            | [`docs/engines/comment.md`](../../docs/engines/comment.md)   |
| `markdown` | `whitespace`, `layout`, `consistency`, `japanese`, `content` | [`docs/engines/markdown.md`](../../docs/engines/markdown.md) |
| `tsdoc`    | `correctness`, `suppressions`, `completeness`, `style`       | [`docs/engines/tsdoc.md`](../../docs/engines/tsdoc.md)       |

## Baseline

A project that adopts the checks on an existing tree records the findings it has today in `quality-baseline.json`, so only the findings it adds later fail.
`--update-baseline` replaces that file with the current findings:

```bash
quality-check --update-baseline
```

Every run reports the new findings and counts the baseline entries that no longer appear as `resolved`.
Fix the new findings, and run `--update-baseline` only when the team accepts one on purpose.
An entry is identified by its engine, rule, file, and message, so a change to a message re-baselines that rule.
Set `baseline` to `false` in `quality.json` to diff nothing and report every finding.

## Commands

`quality-check migrate` rewrites a `quality.json` in the old format into the current one.
It previews by default and writes only with `--write`.
If any setting cannot be converted, the file is left unchanged even with `--write`; the command prints what to fix by hand and exits with 1.
See [engine-name migration and compatibility](../../docs/engine-contract.md#engine名の移行と互換性) for configuration, baseline, suppression, and review-ledger compatibility.

```bash
quality-check migrate
quality-check migrate --write
quality-check migrate --from-v5 --write
```

`quality-check markdown <scan|check|lint>` runs a document command. Without one of these actions, `markdown` selects the finding engine, so `quality-check markdown` and `quality-check markdown docs` use the integrated runner:

```bash
quality-check markdown lint .
quality-check markdown lint --write .
quality-check markdown lint --preset all .
quality-check markdown scan doc.md --rules SKILL.md --review review.json
quality-check markdown check doc.md --rules SKILL.md --review review.json
```

| Command | Description                                                           |
| ------- | --------------------------------------------------------------------- |
| `scan`  | Write an unconfirmed review record for the given documents            |
| `check` | Verify a filled review record against the current documents and rules |
| `lint`  | Report mechanical violations, or fix them with `--write`              |

The review file pins the document bytes and the rules bytes by hash, so editing either one invalidates the record.
`check` only confirms that every candidate carries a decision and a reason; it does not judge the writing.

## Options

| Option               | Description                                                               |
| -------------------- | ------------------------------------------------------------------------- |
| `--config <path>`    | Config file to load (default `quality.json`)                              |
| `--baseline <path>`  | Override the baseline file                                                |
| `--ignore <path>`    | Add an excluded path, repeatable                                          |
| `--update-baseline`  | Replace the baseline with the current findings                            |
| `--json`             | Print the per-engine results as JSON                                      |
| `markdown <command>` | Run the review ledger (`scan`, `check`, or `lint`)                        |
| `migrate`            | Rewrite an old `quality.json` (`--config <path>`, `--write`, `--from-v5`) |

`--ignore` and the positional targets reach only the engines that take them.

### markdown

| Option              | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| `--rules <path>`    | Rules file that holds the criteria, required by `scan` and `check` |
| `--review <path>`   | Review file to write or read                                       |
| `--preset <preset>` | Start from the `recommended` (default), `all`, or `none` preset    |
| `--enable <rule>`   | Run an opt-in rule, repeatable                                     |
| `--disable <rule>`  | Turn a rule off, repeatable                                        |
| `--ignore <path>`   | Path to leave out, repeatable                                      |
| `--write`           | Apply `lint` fixes instead of reporting them                       |
| `--json`            | Print findings as JSON                                             |

Color is added only when stdout is a terminal.
`NO_COLOR` turns it off and `FORCE_COLOR` turns it on; the `--json` output stays plain.
