[日本語](README.ja.md)

# @yuu1111/quality-check

Runs Biome, Knip, comment-check, document-style-check, and the TSDoc checker
from one CLI instead of one script per project. The baseline diff lives here too.

## Install

```bash
bun add -D @yuu1111/quality-check
```

## Usage

Declare the engines and the excluded paths in `quality.config.ts`, then call the
CLI from a script:

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
    knip: true,
    "comment-check": true,
    "document-style-check": true,
    "tsdoc-check": { args: ["--error", "missing-doc"] },
  },
  ignore: ["FFXIVReplayAnalyzer"],
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
| `engines` | Engines to run, as `true` or `{ args }` |
| `ignore` | Paths that the file-scanning engines leave out |
| `baseline` | Baseline file path; `false` disables the diff |
| `targets` | Targets passed to the file-scanning engines |

Engines run in the order `biome`, `knip`, `comment-check`, `document-style-check`, `tsdoc-check`.
`args` is appended after the engine defaults, so engine-specific flags such as
`--error` for `tsdoc-check` belong there.

## Options

| Option | Description |
|--------|-------------|
| `--config <path>` | Config file to load (default `quality.config.ts`) |
| `--baseline <path>` | Override the baseline file |
| `--ignore <path>` | Add an excluded path, repeatable |
| `--update-baseline` | Replace the baseline with the current findings |
| `--json` | Print the per-engine results as JSON |

## Notes

Exit code 0 means every engine passed, 1 that at least one failed, and 2 that the
configuration or an engine could not start.

Biome and Knip keep their excluded paths in their own config (`biome.json`,
`knip.ts`). `ignore` reaches the file-scanning engines as `--ignore` and is not
passed to Biome or Knip.

`comment-check` runs with an unwritten baseline path so that it reports every
finding. The new-and-resolved diff is done by this CLI from a single baseline
file, so an existing `comment-baseline.json` is moved over with
`--update-baseline`.

## License

MIT
