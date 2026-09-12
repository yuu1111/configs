[日本語](README.ja.md)

# @yuu1111/comment-check

Small comment checker with a baseline, used to keep suppressions and placeholder comments from spreading.

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

```text
src/queue.ts:18:2 undocumented-directive TypeScript directive needs a description
Checked 42 files: 1 new, 0 resolved, 3 baselined
```

A project that also keeps Japanese sentences free of a trailing `。` names the opt-in rule:

```bash
comment-check --enable japanese-period .
```

A project that keeps a blank line before every multi-line comment names the other opt-in rule:

```bash
comment-check --enable cramped-comment .
```

## Rules

| Rule | Severity | Default | Detects |
|------|----------|---------|---------|
| `broad-suppression` | error | true | `biome-ignore-all`, `@ts-nocheck`, and rule-less `eslint-disable` |
| `cramped-comment` | error | false | a multi-line block comment written directly under the previous line |
| `undocumented-directive` | error | true | `@ts-ignore` or `@ts-expect-error` without a description |
| `placeholder-comment` | error | true | `TODO`, `FIXME`, `XXX`, `HACK` |
| `separator-comment` | error | true | decorative comments made only of punctuation |
| `japanese-period` | error | false | a Japanese sentence in a comment that ends with `。` |

## Options

| Option | Description |
|--------|-------------|
| `--baseline <path>` | Baseline file to read or write (default `comment-baseline.json`) |
| `--enable <rule>` | Run an opt-in rule, repeatable; an unknown name is a configuration error |
| `--ignore <path>` | Path to leave out, repeatable |
| `--update-baseline` | Replace the baseline with the current findings |
| `--json` | Print new and resolved findings as JSON |
