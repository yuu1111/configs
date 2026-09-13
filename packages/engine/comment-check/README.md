[日本語](README.ja.md)

# @yuu1111/comment-check

Small comment checker that keeps suppressions and placeholder comments from spreading.

This engine is a private workspace package bundled into `@yuu1111/quality-check`, and it is enabled through its `comment-check` section in `quality.json`.

## Usage

Enable the engine and select its rules in the `comment-check` section:

```json
{
  "comment-check": {
    "enabled": true,
    "targets": ["src"],
    "ignore": ["generated"],
    "rules": {
      "preset": "recommended",
      "shape": {
        "cramped-comment": "on"
      },
      "content": {
        "japanese-period": "on"
      }
    }
  }
}
```

`cramped-comment` and `japanese-period` are opt-in rules, so `preset` alone leaves them off.
`cramped-comment` requires a blank line before every multi-line block comment, and `japanese-period` keeps a Japanese sentence in a comment from ending with `。`.
A rule that is on by default can be turned off with `off` in `rules`.

The baseline diff is owned by `@yuu1111/quality-check`, so this engine reports every finding that it sees.

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
| `broad-suppression` | error | true | `biome-ignore-all`, `@ts-nocheck`, and rule-less `eslint-disable` |
| `cramped-comment` | error | false | a multi-line block comment written directly under the previous line |
| `undocumented-directive` | error | true | `@ts-ignore` or `@ts-expect-error` without a description |
| `placeholder-comment` | error | true | `TODO`, `FIXME`, `XXX`, `HACK` |
| `separator-comment` | error | true | decorative comments made only of punctuation |
| `japanese-period` | error | false | a Japanese sentence in a comment that ends with `。` |

The `suppression`, `shape`, and `content` groups hold these rules.
The engine exposes its rule vocabulary as the `./rule-ids` subpath (`RULE_IDS`, `OPT_IN_RULE_IDS`, `RULE_GROUPS`), and that vocabulary is what the `$schema` of `quality.json` reads for this section.
