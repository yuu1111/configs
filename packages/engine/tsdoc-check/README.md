[日本語](README.ja.md)

# @yuu1111/tsdoc-check

Shared TSDoc checker for exported declarations.

## Usage

Enable the engine and select its rules in the `tsdoc-check` section:

```json
{
  "tsdoc-check": {
    "enabled": true,
    "targets": ["src"],
    "ignore": ["generated"],
    "rules": {
      "preset": "recommended",
      "syntax": {
        "tsdoc-tag": "error"
      },
      "documentation": {
        "missing-returns": "on",
        "deprecated-without-guidance": "on"
      },
      "contract": {
        "param-order": "on"
      }
    }
  }
}
```

`tsdoc-check` is the only built-in engine that takes `error`, which raises a rule and turns an opt-in rule on first.
`preset` alone leaves `param-order`, `missing-returns`, and `deprecated-without-guidance` off, so they need `on`.

## Config

| Condition | Description |
|-----------|-------------|
| `enabled` | Start the engine; an omitted or `false` section leaves it off |
| `targets` | Paths to check; omitted falls back to the current directory |
| `ignore` | Paths to leave out |
| `rules` | Rule selection at the `preset`, group, and rule levels; the most specific setting wins |

`preset` takes `recommended` for the engine defaults, `all` to turn every rule on, and `none` to turn every rule off.
A group key names a group that the engine publishes and takes `off`, `on`, or `error` for that whole group, and an object under a group key names single rules.
`error` is accepted only here, because `tsdoc-check` is the only built-in engine that promotes a rule.
The engine runs in-process, so it takes no `args` condition.

## Rules

| Rule | Severity | Default | Detects |
|------|----------|---------|---------|
| `tsdoc-syntax` | error | true | A syntax message from the TSDoc parser |
| `param-mismatch` | error | true | `@param` naming a parameter that the signature does not declare |
| `type-param-mismatch` | error | true | `@typeParam` naming a type parameter that the declaration does not declare |
| `tsdoc-tag` | warning | true | A tag that the TSDoc configuration does not define |
| `missing-doc` | warning | true | An exported declaration without a TSDoc comment |
| `single-line-doc` | warning | true | A TSDoc comment written on a single line |
| `blank-line-before-tags` | warning | true | A block tag written directly under the summary |
| `param-untagged` | warning | true | A declared parameter without a `@param` tag |
| `type-param-untagged` | warning | true | A declared type parameter without a `@typeParam` tag |
| `param-order` | warning | false | `@param` tags out of the declaration order |
| `missing-returns` | warning | false | A function that returns a value without a `@returns` tag |
| `deprecated-without-guidance` | warning | false | A `@deprecated` tag that points to no replacement |

`blank-line-before-tags` requires a blank `*` line between the summary and the first block tag, so the tag block starts one line below the description. Tags stay together below that blank line, and a comment that opens with a tag and no summary is left alone.

A tag that TSDoc does not define is a warning under `tsdoc-tag`, so `@description` and any other non-standard tag are reported there.
Setting `tsdoc-tag` to `error` under the `syntax` group raises every one of them to an error.

`param-order`, `missing-returns`, and `deprecated-without-guidance` stay off until `rules` sets them to `on`, as the usage example does.
`missing-returns` reads an explicit return type only, so a function without an annotation is left alone, and `Promise<void>` counts as no return value.
`deprecated-without-guidance` accepts a `@see` tag or a `{@link}` in the deprecation message as the pointer to the replacement.

Only top-level exported declarations are checked.
A file that does not parse is left to the TypeScript compiler and to Biome, so its declarations are not checked.

The engine exposes its rule vocabulary as the `./rule-ids` subpath (`KNOWN_RULE_NAMES`, `OPT_IN_RULE_IDS`, `RULE_GROUPS`), and that vocabulary is what the `$schema` of `quality.json` reads for this section.

## Suppressions

An exception carries its own reason next to the declaration:

```ts
// tsdoc-check-ignore missing-doc: the loader reads this value
export const value = 1
```

A suppression without a reason, with an unknown rule, or without any rule is an error, and a suppression that covers nothing is a warning.
