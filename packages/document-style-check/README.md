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

```
AGENTS.md:18:1 hard-break-html error an HTML hard break adds spacing without meaning
Checked 14 files: 1 errors, 0 warnings
```

Record the candidates that need a judgment, fill them in, then verify:

```bash
document-style-check scan doc.md --rules SKILL.md --review review.json
document-style-check check doc.md --rules SKILL.md --review review.json
```

The review file pins the document bytes and the rules bytes by hash, so editing either one invalidates the record.
`check` only confirms that every candidate carries a decision and a reason; it does not judge the writing.

## Commands

| Command | Description |
|---------|-------------|
| `scan` | Write an unconfirmed review record for the given documents |
| `check` | Verify a filled review record against the current documents and rules |
| `lint` | Report mechanical violations, or fix them with `--write` |

## Rules

| Rule | Detects |
|------|---------|
| `consecutive-blank-lines` | runs of blank lines that add spacing without meaning |
| `date-anchored-statement` | a check date used in place of the subject's identity |
| `hard-break-html` | `<br>` in prose |
| `trailing-backslash` | a backslash at the end of a prose line |
| `trailing-whitespace` | whitespace at the end of a line |

Every rule except `date-anchored-statement` is fixable, so `lint --write` clears all errors and leaves the warnings for a human or a model to judge.

## Options

| Option | Description |
|--------|-------------|
| `--rules <path>` | Rules file that holds the `## 判断基準` criteria, required by `scan` and `check` |
| `--review <path>` | Review file to write or read |
| `--ignore <path>` | Path to leave out, repeatable |
| `--write` | Apply the fixes instead of reporting them |
| `--json` | Print findings as JSON |

## Notes

`scan` refuses to overwrite an existing review file, so regenerate it under a new name rather than trusting a stale record.

The rules file is a Markdown document whose `## 判断基準` section lists one heading per judgment.
The package ships no criteria of its own: the document-style skill's `SKILL.md` is one such file, and any other file with the same shape works.
