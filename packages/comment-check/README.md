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

A project that also keeps Japanese sentences free of a trailing `。` names the
opt-in rule:

```bash
comment-check --enable japanese-period .
```

## Rules

| Rule | Detects |
|------|---------|
| `broad-suppression` | `biome-ignore-all`, `@ts-nocheck`, and rule-less `eslint-disable` |
| `undocumented-directive` | `@ts-ignore` or `@ts-expect-error` without a description |
| `placeholder-comment` | `TODO`, `FIXME`, `XXX`, `HACK` |
| `separator-comment` | decorative comments made only of punctuation |
| `japanese-period` | a Japanese sentence in a comment that ends with `。` (opt-in) |

## Options

| Option | Description |
|--------|-------------|
| `--baseline <path>` | Baseline file to read or write (default `comment-baseline.json`) |
| `--enable <rule>` | Run an opt-in rule, repeatable; an unknown name is a configuration error |
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

`japanese-period` stays off until `--enable` names it, so an existing project
keeps the findings it had. The rule reports the first `。` of a comment at its
own line and column, reports one finding per comment however many periods it
holds, and never rewrites the comment.
