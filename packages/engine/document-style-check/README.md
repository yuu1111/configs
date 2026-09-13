[日本語](README.ja.md)

# @yuu1111/document-style-check

Small Markdown checker with a review ledger, used to keep mechanical violations out of documents and to record a written judgment on the rest.

This engine is a private workspace package bundled into `@yuu1111/quality-check`, and it is enabled through its `document-style-check` section in `quality.json`.

## Usage

Enable the engine and select its rules in the `document-style-check` section:

```json
{
  "document-style-check": {
    "enabled": true,
    "targets": ["docs"],
    "ignore": ["CHANGELOG.md"],
    "rules": {
      "preset": "recommended",
      "typography": {
        "japanese-period": "on"
      },
      "structure": {
        "list-marker-consistency": "on"
      }
    }
  }
}
```

`typography` and `structure` are two of the four rule groups, and the selection turns on two opt-in rules while `preset` keeps the engine defaults.
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
| `code-fence-language` | error | true | a code fence with no language |
| `consecutive-blank-lines` | error | true | runs of blank lines that add spacing without meaning |
| `date-anchored-statement` | warning | true | a check date used in place of the subject's identity |
| `empty-link` | error | true | a link with no text or no destination |
| `full-width-alphanumeric` | error | false | a full-width alphanumeric such as `Ａ` or `１` |
| `hard-break-html` | error | true | `<br>` in prose |
| `heading-level-jump` | warning | true | a heading level that skips a step |
| `japanese-comma` | error | false | a half-width comma inside Japanese text |
| `japanese-period` | error | false | a Japanese sentence that ends with `。` |
| `list-marker-consistency` | error | false | an unordered list marker that differs from the first one |
| `trailing-backslash` | error | true | a backslash at the end of a prose line |
| `trailing-whitespace` | error | true | whitespace at the end of a line |

The `whitespace`, `typography`, `structure`, and `content` groups hold these rules.
`consecutive-blank-lines`, `hard-break-html`, `trailing-backslash`, and `trailing-whitespace` are fixable, so `quality-check document-style lint --write` clears them.
`list-marker-consistency` is fixable too, but only once it is enabled, because it rewrites every list to the first marker it finds.
`code-fence-language`, `empty-link`, `full-width-alphanumeric`, `japanese-comma`, and `japanese-period` stay errors after `--write`.
`date-anchored-statement` and `heading-level-jump` are warnings for a human or a model to judge.

The engine exposes its rule vocabulary as the `./rule-ids` subpath (`RULE_IDS`, `OPT_IN_RULE_IDS`, `RULE_GROUPS`), and that vocabulary is what the `$schema` of `quality.json` reads for this section.

## Commands

The review ledger of this engine is reached through the one binary:

```bash
quality-check document-style lint .
quality-check document-style lint --write .
quality-check document-style lint --enable japanese-period .
quality-check document-style scan doc.md --rules SKILL.md --review review.json
quality-check document-style check doc.md --rules SKILL.md --review review.json
```

| Command | Description |
|---------|-------------|
| `scan` | Write an unconfirmed review record for the given documents |
| `check` | Verify a filled review record against the current documents and rules |
| `lint` | Report mechanical violations, or fix them with `--write` |

The review file pins the document bytes and the rules bytes by hash, so editing either one invalidates the record.
`check` only confirms that every candidate carries a decision and a reason; it does not judge the writing.

### Options

| Option | Description |
|--------|-------------|
| `--rules <path>` | Rules file that holds the `## 判断基準` criteria, required by `scan` and `check` |
| `--review <path>` | Review file to write or read |
| `--enable <rule>` | Run an opt-in rule, repeatable; an unknown name is a configuration error |
| `--disable <rule>` | Turn a rule off, including one that is on by default, repeatable; an unknown name is a configuration error, and a rule cannot be both enabled and disabled |
| `--ignore <path>` | Path to leave out, repeatable |
| `--write` | Apply the fixes instead of reporting them |
