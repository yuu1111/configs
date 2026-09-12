[日本語](README.ja.md)

# @yuu1111/code-style-check

A small source style checker without a baseline.
It keeps one blank line between adjacent function definitions.

## Install

```bash
bun add -D @yuu1111/code-style-check
```

## Usage

```bash
code-style-check .
code-style-check --ignore generated src
```

```text
src/worker.ts:8:1 blank-line-between-functions error the function definition submitRootMessage needs a single blank line before it
Checked 42 files: 1 errors, 0 warnings
```

## Rules

| Rule | Finding | Severity |
|------|---------|----------|
| `blank-line-between-functions` | Adjacent function definitions have no blank line | error |
| `blank-line-between-functions` | Adjacent function definitions have more than one blank line | warning |

## Definitions that are checked

- `function` declarations, including `export`, `async`, and generators
- Class constructors, methods, getters, and setters, private ones included

These are not treated as definitions:

- Overload signatures and abstract methods (declarations without a body)
- Interface method signatures
- Object literal methods
- Arrow functions assigned to variables
- A pair with another statement between it, since it is not adjacent

## How the blank line is counted

The rule requires exactly one consecutive whitespace-only line between the end
of a definition and the start of the next one.

A comment line in between is not counted as a blank line and breaks the run, so
the blank line may sit above or below the comment.

## Relation to other linters

- Like Ruby's RuboCop `Layout/EmptyLineBetweenDefs`, only adjacent definitions are checked
- Python's pycodestyle E302 and E305 require blank lines around every top-level definition, while this rule stays with adjacent pairs
- Like Java's Checkstyle `EmptyLineSeparator`, class members count as definitions
- The warning for too many blank lines follows pycodestyle E303 and rustfmt's `blank_lines_upper_bound`

## Options

| Option | Description |
|--------|-------------|
| `--ignore <path>` | Exclude a path, repeatable |
| `--json` | Print the findings as `errors` and `warnings` JSON |
