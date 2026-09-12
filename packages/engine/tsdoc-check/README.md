[日本語](README.ja.md)

# @yuu1111/tsdoc-check

Shared TSDoc checker for exported declarations.

## Install

```bash
bun add -D @yuu1111/tsdoc-check
```

## Usage

```bash
bunx tsdoc-check src
```

| Option | Description |
|--------|-------------|
| `--error <rule>` | Raise the rule to an error, repeatable |
| `--ignore <path>` | Path to leave out, repeatable |
| `--json` | Print the findings as JSON |

## Rules

| Rule | Severity | Detects |
|------|----------|---------|
| `tsdoc-syntax` | error | A syntax message from the TSDoc parser |
| `param-mismatch` | error | `@param` naming a parameter that the signature does not declare |
| `tsdoc-tag` | warning | A tag that the TSDoc configuration does not define |
| `type-param-mismatch` | error | `@typeParam` naming a type parameter that the declaration does not declare |
| `missing-doc` | warning | An exported declaration without a TSDoc comment |
| `single-line-doc` | warning | A TSDoc comment written on a single line |

A tag that TSDoc does not define is a warning under `tsdoc-tag`, so
`@description` and any other non-standard tag are reported there, and
`--error tsdoc-tag` raises every one of them to an error.

Only top-level exported declarations are checked. A file that does not parse is
left to the TypeScript compiler and to Biome, so its declarations are not
checked.

## Suppressions

An exception carries its own reason next to the declaration:

```ts
// tsdoc-check-ignore missing-doc: the loader reads this value
export const value = 1
```

A suppression without a reason, with an unknown rule, or without any rule is
an error, and a suppression that covers nothing is a warning.
