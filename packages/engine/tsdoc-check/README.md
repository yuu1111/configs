[日本語](README.ja.md)

# @yuu1111/tsdoc-check

Shared TSDoc checker for exported declarations.

## Install

```bash
bun add -D @yuu1111/tsdoc-check
```

## Usage

```bash
tsdoc-check src
```

## Rules

| Rule | Severity | Default | Detects |
|------|----------|---------|---------|
| `tsdoc-syntax` | error | true | A syntax message from the TSDoc parser |
| `param-mismatch` | error | true | `@param` naming a parameter that the signature does not declare |
| `type-param-mismatch` | error | true | `@typeParam` naming a type parameter that the declaration does not declare |
| `tsdoc-tag` | warning | true | A tag that the TSDoc configuration does not define |
| `missing-doc` | warning | true | An exported declaration without a TSDoc comment |
| `single-line-doc` | warning | true | A TSDoc comment written on a single line |
| `param-untagged` | warning | true | A declared parameter without a `@param` tag |
| `type-param-untagged` | warning | true | A declared type parameter without a `@typeParam` tag |
| `param-order` | warning | false | `@param` tags out of the declaration order |
| `missing-returns` | warning | false | A function that returns a value without a `@returns` tag |
| `deprecated-without-guidance` | warning | false | A `@deprecated` tag that points to no replacement |

A tag that TSDoc does not define is a warning under `tsdoc-tag`, so `@description` and any other non-standard tag are reported there.
`--error tsdoc-tag` raises every one of them to an error.

`param-order`, `missing-returns`, and `deprecated-without-guidance` stay off until `--enable` names them:

```bash
tsdoc-check --enable missing-returns --enable param-order --enable deprecated-without-guidance src
```

`missing-returns` reads an explicit return type only, so a function without an annotation is left alone, and `Promise<void>` counts as no return value.
`deprecated-without-guidance` accepts a `@see` tag or a `{@link}` in the deprecation message as the pointer to the replacement.

Only top-level exported declarations are checked.
A file that does not parse is left to the TypeScript compiler and to Biome, so its declarations are not checked.

The rule identifiers are published as `@yuu1111/tsdoc-check/rule-ids` (`TsdocRule`, `OptInRuleId`) for a TypeScript config such as `quality.config.ts`.

## Suppressions

An exception carries its own reason next to the declaration:

```ts
// tsdoc-check-ignore missing-doc: the loader reads this value
export const value = 1
```

A suppression without a reason, with an unknown rule, or without any rule is an error, and a suppression that covers nothing is a warning.

## Options

| Option | Description |
|--------|-------------|
| `--enable <rule>` | Turn on an opt-in rule, repeatable |
| `--error <rule>` | Raise the rule to an error, repeatable |
| `--ignore <path>` | Path to leave out, repeatable |
| `--json` | Print the findings as JSON |
