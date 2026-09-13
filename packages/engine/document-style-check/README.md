[日本語](README.ja.md)

# @yuu1111/document-style-check

Small Markdown checker with a review ledger, used to keep mechanical violations out of documents and to record a written judgment on the rest.

## Install

```bash
bun add -D @yuu1111/document-style-check
```

## Usage

Report or fix the violations that carry no meaning:

```bash
document-style-check lint .
document-style-check lint --write .
```

```text
AGENTS.md:18:1 hard-break-html error an HTML hard break adds spacing without meaning
Checked 14 files: 1 errors, 0 warnings
```

A project that also keeps Japanese sentences free of a trailing `。`, of a half-width comma, and of full-width alphanumerics names the opt-in rules:

```bash
document-style-check lint --enable japanese-period --enable japanese-comma --enable full-width-alphanumeric .
```

Record the candidates that need a judgment, fill them in, then verify:

```bash
document-style-check scan doc.md --rules SKILL.md --review review.json
document-style-check check doc.md --rules SKILL.md --review review.json
```

The review file pins the document bytes and the rules bytes by hash, so editing either one invalidates the record.
`check` only confirms that every candidate carries a decision and a reason; it does not judge the writing.

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

`consecutive-blank-lines`, `hard-break-html`, `trailing-backslash`, and `trailing-whitespace` are fixable, so `lint --write` clears them.
`list-marker-consistency` is fixable too, but only once it is enabled, because it rewrites every list to the first marker it finds.
`code-fence-language`, `empty-link`, `full-width-alphanumeric`, `japanese-comma`, and `japanese-period` stay errors after `--write`.
`date-anchored-statement` and `heading-level-jump` are warnings for a human or a model to judge.

The rule identifiers are published as `@yuu1111/document-style-check/rule-ids` (`RuleId`, `OptInRuleId`) and is the rule vocabulary that the `$schema` of `quality.json` reads.

## Commands

| Command | Description |
|---------|-------------|
| `scan` | Write an unconfirmed review record for the given documents |
| `check` | Verify a filled review record against the current documents and rules |
| `lint` | Report mechanical violations, or fix them with `--write` |

## Options

| Option | Description |
|--------|-------------|
| `--rules <path>` | Rules file that holds the `## 判断基準` criteria, required by `scan` and `check` |
| `--review <path>` | Review file to write or read |
| `--enable <rule>` | Run an opt-in rule, repeatable; an unknown name is a configuration error |
| `--disable <rule>` | Turn a rule off, including one that is on by default, repeatable; an unknown name is a configuration error, and a rule cannot be both enabled and disabled |
| `--ignore <path>` | Path to leave out, repeatable |
| `--write` | Apply the fixes instead of reporting them |
| `--json` | Print findings as JSON |
