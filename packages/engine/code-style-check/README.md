[日本語](README.ja.md)

# @yuu1111/code-style-check

Source style checker for TypeScript and JavaScript.

## Usage

Enable the engine and select its rules in the `code-style-check` section:

```json
{
  "code-style-check": {
    "enabled": true,
    "targets": ["src"],
    "ignore": ["generated"],
    "rules": {
      "preset": "recommended",
      "spacing": "on"
    }
  }
}
```

`spacing` is the only rule group, and it holds every rule this engine reports.
A rule that is on by default can be turned off with `off` in `rules`.

## Config

| Condition | Description |
|-----------|-------------|
| `enabled` | Start the engine; an omitted or `false` section leaves it off |
| `targets` | Paths to check; omitted falls back to the current directory |
| `ignore` | Paths to leave out |
| `rules` | Rule selection at the `preset`, group, and rule levels; the most specific setting wins |

`preset` takes `recommended` for the engine defaults, `all` to turn every rule on, and `none` to turn every rule off.
A group key names a group that the engine publishes and takes `off` or `on` for that whole group, and an object under a group key names single rules.
The engine runs in-process, so it takes no `args` condition.

## Rules

| Rule | Severity | Default | Detects |
|------|----------|---------|---------|
| `blank-line-between-class-members` | error | true | A class property and the adjacent member have no blank line |
| `blank-line-between-class-members` | warning | true | A class property and the adjacent member have more than one blank line |
| `blank-line-between-definitions` | error | true | Adjacent definitions have no blank line |
| `blank-line-between-definitions` | warning | true | Adjacent definitions have more than one blank line |

The `spacing` group holds both rules.
The engine exposes its rule vocabulary as the `./rule-ids` subpath (`RULE_IDS`, `OPT_IN_RULE_IDS`, `RULE_GROUPS`), and that vocabulary is what the `$schema` of `quality.json` reads for this section.

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
