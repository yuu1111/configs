[日本語](README.ja.md)

# @yuu1111/code-style-check

A small source style checker that keeps one blank line between adjacent definitions.

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
src/worker.ts:8:1 blank-line-between-definitions error the function definition submitRootMessage needs a single blank line before it
Checked 42 files: 1 errors, 0 warnings
```

## Rules

| Rule | Severity | Default | Detects |
|------|----------|---------|---------|
| `blank-line-between-class-members` | error | true | A class property and the adjacent member have no blank line |
| `blank-line-between-class-members` | warning | true | A class property and the adjacent member have more than one blank line |
| `blank-line-between-definitions` | error | true | Adjacent definitions have no blank line |
| `blank-line-between-definitions` | warning | true | Adjacent definitions have more than one blank line |

The rule identifiers are published as `@yuu1111/code-style-check/rule-ids` (`RuleId`) and are the rule vocabulary that the `$schema` of `quality.json` reads.

A rule that is on by default can be turned off with `--disable`.

## Definitions that are checked

- `function` declarations, including `export`, `async`, and generators
- `class` declarations
- `type`, `interface`, `enum`, and `namespace` declarations
- `const`, `let`, and `var` declarations
- Class constructors, methods, getters, and setters, private ones included
- Class properties, including `#name`, `accessor`, `declare`, and `abstract` ones

These are not treated as definitions:

- Overload signatures and abstract methods (declarations without a body)
- Interface method signatures
- Object literal methods
- Class static blocks
- Imports, re-exports, and any other statement that is not a declaration
- A pair with another statement between it, since it is not adjacent

A pair of two variable declarations and a pair of two class properties do not need a blank line, so they may be grouped.

## How the blank line is counted

The rule requires exactly one consecutive whitespace-only line between the end of a definition and the start of the next one.

A comment line in between is not counted as a blank line and breaks the run, so the blank line may sit above or below the comment.

## Options

| Option | Description |
|--------|-------------|
| `--disable <rule>` | Turn a rule off, repeatable; an unknown name is a configuration error |
| `--ignore <path>` | Exclude a path, repeatable |
| `--json` | Print the findings as `errors` and `warnings` JSON |
