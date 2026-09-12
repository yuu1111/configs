[日本語](README.ja.md)

# @yuu1111/comment-check

Small comment checker with a baseline, used to keep suppressions and placeholder
comments from spreading.

## Install

```bash
bun add -D @yuu1111/comment-check
```

## Usage

Record the current findings once, then fail only when a new one appears:

```bash
comment-check --update-baseline .
comment-check .
```

```
src/queue.ts:18:2 undocumented-directive TypeScript directive needs a description
Checked 42 files: 1 new, 0 resolved, 3 baselined
```

## Rules

| Rule | Detects |
|------|---------|
| `broad-suppression` | `biome-ignore-all`, `@ts-nocheck`, and rule-less `eslint-disable` |
| `undocumented-directive` | `@ts-ignore` or `@ts-expect-error` without a description |
| `placeholder-comment` | `TODO`, `FIXME`, `XXX`, `HACK` |
| `separator-comment` | decorative comments made only of punctuation |

## Options

| Option | Description |
|--------|-------------|
| `--baseline <path>` | Baseline file to read or write (default `comment-baseline.json`) |
| `--ignore <path>` | Path to leave out, repeatable |
| `--update-baseline` | Replace the baseline with the current findings |
| `--json` | Print new and resolved findings as JSON |

## Notes

Generated directories and other paths that the project owns stay out of the
check through `--ignore`, for example `--ignore src/generated`.

The baseline keys on the rule, the file, and the comment text, so moving a line
does not report the comment as new. Biome already requires a reason on
`biome-ignore` and reports unused suppressions, so this checker only covers the
comment trivia that Biome does not read.
