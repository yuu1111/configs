[日本語](README.ja.md)

# @yuu1111/comment-check

Small comment checker that keeps suppressions and placeholder comments from spreading.

## Install

```bash
bun add -D @yuu1111/comment-check
```

## Usage

```bash
comment-check .
comment-check --ignore generated src
```

```text
src/queue.ts:18:2 undocumented-directive error TypeScript directive needs a description
Checked 42 files: 1 errors, 0 warnings
```

The baseline diff is owned by `@yuu1111/quality-check`, so this CLI reports every finding that it sees.

A project that keeps Japanese sentences free of a trailing `。` enables an opt-in rule:

```bash
comment-check --enable japanese-period .
```

A project that wants a blank line before every multi-line comment enables the other opt-in rule:

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

The rule identifiers are published as `@yuu1111/comment-check/rule-ids` (`RuleId`, `OptInRuleId`) and are the rule vocabulary that the `$schema` of `quality.json` reads.

A rule that is on by default can be turned off with `--disable`.

## Options

| Option | Description |
|--------|-------------|
| `--enable <rule>` | Run an opt-in rule, repeatable; an unknown name is a configuration error |
| `--disable <rule>` | Turn a rule off, repeatable; an unknown name is a configuration error, and a rule cannot be both enabled and disabled |
| `--ignore <path>` | Path to leave out, repeatable |
| `--json` | Print the findings as `errors` and `warnings` |
