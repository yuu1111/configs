[English](README.md)

# @yuu1111/quality-check

設定したengineを1つのCLIで実行し baselineの差分判定も持つ統合runner

## Install

```bash
bun add -D @yuu1111/quality-check
```

4つの検出engine `code-style-check`、`comment-check`、`document-style-check`、`tsdoc-check` はこのpackageへ同梱する
`bun build` がprivateなworkspace packageを `dist/cli.js` へbundleするため、このpackageを導入すればengine packageの追加導入も実行時の解決も要らない
Biome、`tsc`、Knipは子プロセスのままで、利用Projectの `node_modules/.bin` から解決する

## Usage

`quality.json` で起動するengineを指定し、scriptから起動する

```json
{
  "scripts": {
    "check:quality": "quality-check"
  }
}
```

```ts
{
  "$schema": "./node_modules/@yuu1111/quality-check/schema.json",
  "failOnWarnings": true,
  "biome": {
    "enabled": true
  },
  "comment-check": {
    "enabled": true,
    "includes": ["**", "!another-project/**"],
    "rules": {
      "preset": "recommended",
      "content": {
        "japanese-period": "on"
      }
    }
  },
  "document-style-check": {
    "enabled": true,
    "rules": {
      "preset": "all"
    }
  },
  "tsdoc-check": {
    "enabled": true,
    "rules": {
      "preset": "all"
    }
  }
}
```

engineごとの出力と所要時間、集約summaryを並べて出し、どのengineが失敗したかと実行にかかった合計時間を1回の実行で示す

```text
== biome ==
Checked 128 files in 260ms. No fixes applied.
biome: passed (exit 0, 296ms)

== comment-check ==
src/queue.ts:18:2 placeholder-comment placeholder comment should be resolved or tracked
comment-check: failed (1 new, 0 resolved, 0 warnings, 118ms)

quality-check: 1 of 3 engines failed (1250ms)
  failed: comment-check
  passed: biome, tsdoc-check
```

終了codeは0が全engine成功、1が失敗したengineあり、2が設定またはengine起動の失敗

engine名を渡すとそのengineだけを実行する

```bash
quality-check biome knip
quality-check comment-check docs
```

位置引数のうちengine名と一致するものはengine選択になり、残りは対象pathになる
`--update-baseline` は常に有効な全engineを実行するため、engine選択との併用は拒否する
engine名と一致するpathは `quality-check ./biome` のように `./` を付ける

## Config

| Field | 説明 |
|-------|-------------|
| `<engine>` | engineごとのsectionで `enabled` が起動を決める |
| `<engine>.includes` | 同梱する4つの検出engineが検査するfileのglob |
| `<engine>.rules` | 同梱する4つの検出engineのrule選択 |
| `failOnWarnings` | warningを阻害する検出として扱い、Biomeにも同じ方針を渡す |
| `baseline` | baseline fileのpath `false` なら差分判定を行わない |

engineは `biome` → `typecheck` → `knip` → `code-style-check` → `comment-check` → `document-style-check` → `tsdoc-check` の順に実行する

engineごとのsectionが `enabled` とそのengineが受け取る条件を持つ
engineが受け取らない条件は設定errorにし、打ち間違いが黙って無視されないようにする
`biome`、`typecheck`、`knip` は子プロセスで起動し、4つの検出engineはin-processで起動する

| Engine | Command | 条件 |
|--------|---------|--------------|
| `biome` | `biome check` | `args` 対象fileは `biome.json` が持つ |
| `typecheck` | `tsc --noEmit` | `args`、`projects` 設定は `tsconfig.json` が持つ |
| `knip` | `knip` | `args` 設定は `knip.ts` が持つ |
| `code-style-check` | in-process | `includes`、`rules` |
| `comment-check` | in-process | `includes`、`rules` |
| `document-style-check` | in-process | `includes`、`rules` |
| `tsdoc-check` | in-process | `includes`、`rules` |

`args` は子プロセスengineだけが受け取り、engineの既定引数の後ろへ足す
設定fileで表せない起動条件や、engineの引数が変わったときの逃げ道として使う
`failOnWarnings` がtrueならBiomeへ `--error-on-warnings` を自動で渡し、他の子プロセスengineは終了codeをそのまま使う

`includes` はProject rootからの相対pathをglobで選ぶ
指定を省略すると `**` になり、空の配列は何も検査しない
否定globは先に選んだfileを除外し、後の肯定globで再び含められるため、配列の順序が結果へ影響する

engineが受け取らない条件は渡さず、その旨をそのengineのsectionへ出す

```text
== biome ==
biome: ignore skipped (biome.json holds its settings)
```

`rules` は同梱するengineのどのruleを実行してどう報告するかを選ぶ
`rules.preset` は一括で選び `recommended` はengineの既定 `all` は全て有効 `none` は全て無効にする
group名のkeyはengineが公開するruleのまとまりで、そのgroupの全ruleへ `off`、`on`、`warn`、`error` を渡す
group名の下のobjectはruleを1つずつ選ぶ
具体的な指定が勝つため preset、group、rule の順に書ける
`off` は既定で有効なruleにも渡せ、`on` はengineの既定severityのままにする
`warn` と `error` は全ての検出engineでruleの重大度を変更し、opt-inのruleは先に有効にする
engineが知らないgroup名やrule名は設定errorになり、配布する `schema.json` がeditorへ同じ語彙を教える
選んだruleは同梱するengineへ直接渡すため、CLIは `--enable`、`--disable`、`--error` へは変換しない

検出engineはbaselineを持たないため、新規と解消済みの判定はengineごとではなく統合CLIが1つのbaseline fileで行う

`typecheck` は `projects` に並べたtsconfigごとに `tsc --noEmit -p <path>` を起動する
省略時はカレントの `tsconfig.json` を1回だけ読む

## Rules

同梱するengineはそれぞれrule語彙を公開し、設定とruleをengineごとに1つの文書へまとめる

| Engine | Group | 設定とrule |
|--------|-------|-----------|
| `code-style-check` | `spacing` | [`docs/engines/code-style-check.md`](../../../docs/engines/code-style-check.md) |
| `comment-check` | `suppression`、`shape`、`content` | [`docs/engines/comment-check.md`](../../../docs/engines/comment-check.md) |
| `document-style-check` | `whitespace`、`typography`、`structure`、`content` | [`docs/engines/document-style-check.md`](../../../docs/engines/document-style-check.md) |
| `tsdoc-check` | `syntax`、`documentation`、`contract`、`suppression` | [`docs/engines/tsdoc-check.md`](../../../docs/engines/tsdoc-check.md) |

## Baseline

既存のtreeへ検査を導入するProjectは、その時点の検出を `quality-baseline.json` へ記録し、後から増えた検出だけを失敗にする
`--update-baseline` はそのfileを現在の検出で置き換える

```bash
quality-check --update-baseline
```

実行のたびに新規の検出を報告し、現れなくなったbaselineのentryを `resolved` として数える
新規の検出は直し、意図して受け入れるときだけ `--update-baseline` を実行する
entryの同一性はengineとruleとfileと検出messageで決まるため、messageが変わるとそのruleは再登録が必要になる
`quality.json` の `baseline` を `false` にすると差分判定を行わず、全ての検出を報告する

## Commands

`quality-check document-style` は同梱する `document-style-check` の検証記録を実行する

```bash
quality-check document-style lint .
quality-check document-style lint --write .
quality-check document-style lint --preset all .
quality-check document-style scan doc.md --rules SKILL.md --review review.json
quality-check document-style check doc.md --rules SKILL.md --review review.json
```

| Command | 説明 |
|---------|-------------|
| `scan` | 対象文書の未確認の検証記録を書き出す |
| `check` | 埋めた検証記録を現在の本文と基準に対して確認する |
| `lint` | 機械的な違反を報告し、`--write`で整形する |

記録は本文と基準のhashを固定するため、どちらかを編集すると無効になる `check`が保証するのは全項目に判断と根拠があることだけで、文体判断の正しさは別に確認する

## Options

| Option | 説明 |
|--------|-------------|
| `--config <path>` | 読み込むconfig file（既定は `quality.json`） |
| `--baseline <path>` | baseline fileを上書きする |
| `--ignore <path>` | 除外pathを追加する、複数指定できる |
| `--update-baseline` | 現在の検出でbaselineを置き換える |
| `--json` | engineごとの結果をJSONで出力する |
| `document-style <command>` | 検証記録を実行する（`scan`、`check`、`lint`） |

`--ignore` と位置引数の対象pathは、その条件を受け取るengineへだけ渡す

### document-style

| Option | 説明 |
|--------|-------------|
| `--rules <path>` | `## 判断基準`を持つ基準fileで、`scan`と`check`では必須 |
| `--review <path>` | 読み書きする検証記録file |
| `--preset <preset>` | 起点にするpresetで `recommended`（既定）、`all`、`none` のいずれか |
| `--enable <rule>` | opt-in ruleを実行する、複数指定できる |
| `--disable <rule>` | 既定で有効なruleも含めて無効にする、複数指定できる |
| `--ignore <path>` | 検査から外すpath、複数指定できる |
| `--write` | 報告の代わりに整形を適用する |
| `--json` | 検出をJSONで出力する |

色は標準出力が端末のときだけ付ける `NO_COLOR` で無効にし、`FORCE_COLOR` で強制できる `--json` の出力には付けない
