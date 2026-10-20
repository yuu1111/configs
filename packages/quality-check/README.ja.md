[English](README.md)

# @yuu1111/quality-check

設定したengineを1つのCLIで実行し baselineの差分判定も持つ統合runner

## Install

```bash
bun add -D @yuu1111/quality-check
```

4つの検出engine `code`、`comment`、`markdown`、`tsdoc` はこのpackageへ同梱する
`bun build` が内部engine、共通処理とその依存を `dist/cli.js` へbundleし、公開packageはruntime dependencyを持たない
engine packageの追加導入も実行時の解決も要らない
repo内ではCLI、設定、runner、engine契約、低水準utilityを分ける sourceの責務と依存方向は [構成と設計判断](../../docs/architecture.md) に記す
Biome、Oxlint、Oxfmt、`tsc`、Knipは子プロセスで起動し、利用Projectの `node_modules/.bin` から解決する
有効にするtoolは利用ProjectのdevDependenciesへ入れ、`quality-check` へは同梱しない

## Usage

`quality.json` で起動するengineを指定し、scriptから起動する

```json
{
  "scripts": {
    "check:quality": "quality-check"
  }
}
```

```json
{
  "$schema": "./node_modules/@yuu1111/quality-check/schema.json",
  "failOnWarnings": true,
  "biome": true,
  "oxlint": true,
  "oxfmt": true,
  "comment": {
    "includes": ["**", "!another-project/**"],
    "rules": {
      "japanese-period": "on"
    }
  },
  "markdown": {
    "rules": {
      "preset": "all"
    }
  },
  "tsdoc": {
    "rules": {
      "preset": "all"
    },
    "overrides": [
      {
        "files": ["tests/**"],
        "rules": {
          "missing-doc": "off"
        }
      }
    ]
  }
}
```

engineごとの出力と所要時間、集約summaryを並べて出し、どのengineが失敗したかと実行にかかった合計時間を1回の実行で示す

```text
== biome ==
Checked 128 files in 260ms. No fixes applied.
biome: passed (exit 0, 296ms)

== comment ==
src/queue.ts:18:2 placeholder-comment placeholder comment should be resolved or tracked
comment: failed (1 new, 0 resolved, 0 warnings, 118ms)

quality-check: 1 of 3 engines failed (1250ms)
  failed: comment
  passed: biome, tsdoc
```

終了codeは0が全engine成功、1が失敗したengineあり、2が設定またはengine起動の失敗

engine名を渡すとそのengineだけを実行する

```bash
quality-check biome knip
quality-check comment docs
quality-check markdown
quality-check markdown docs
```

位置引数のうちengine名と一致するものはengine選択になり、残りは対象pathになる
`--update-baseline` は常に有効な全engineを実行するため、engine選択との併用は拒否する
engine名と一致するpathは `quality-check ./biome` のように `./` を付ける

## Config

| Field | 説明 |
|-------|-------------|
| `<engine>` | engineごとのsection `true` と書くか、sectionを書くと起動し、`false` か `enabled: false` で止める |
| `<engine>.includes` | 同梱する4つの検出engineが検査するfileのglob |
| `<engine>.rules` | 同梱する4つの検出engineのrule選択 |
| `<engine>.overrides` | globで選んだfileだけへ重ねるrule選択 |
| `failOnWarnings` | warningを阻害する検出として扱い、BiomeとOxlintにも同じ方針を渡す |
| `baseline` | baseline fileのpath `false` なら差分判定を行わない |

engineは `biome` → `oxlint` → `oxfmt` → `typecheck` → `knip` → `code` → `comment` → `markdown` → `tsdoc` の順に実行する

engineごとのsectionがそのengineが受け取る条件を持つ
sectionを書けばそのengineは起動し、条件が無ければ `"biome": true` のように `true` だけで書ける
止めるときは `false` か `enabled: false` を書く
engineが受け取らない条件は設定errorにし、打ち間違いが黙って無視されないようにする
`biome`、`oxlint`、`oxfmt`、`typecheck`、`knip` は子プロセスで起動し、4つの検出engineはin-processで起動する

| Engine | Command | 条件 |
|--------|---------|--------------|
| `biome` | `biome check` | `args` 対象fileは `biome.json` が持つ |
| `oxlint` | `oxlint` | `args` 対象pathと `--ignore` を受け取る |
| `oxfmt` | `oxfmt --check` | `args` 対象pathを受け取り `--ignore` はskipする |
| `typecheck` | `tsc --noEmit` | `args`、`projects` 設定は `tsconfig.json` が持つ |
| `knip` | `knip` | `args` 設定は `knip.ts` が持つ |
| `code` | in-process | `includes`、`rules`、`overrides` |
| `comment` | in-process | `includes`、`rules`、`overrides` |
| `markdown` | in-process | `includes`、`rules`、`overrides` |
| `tsdoc` | in-process | `includes`、`rules`、`overrides` |

`args` は子プロセスengineだけが受け取り、engineの既定引数の後ろへ足す
設定fileで表せない起動条件や、engineの引数が変わったときの逃げ道として使う
`failOnWarnings` がtrueならBiomeへ `--error-on-warnings`、Oxlintへ `--deny-warnings` を自動で渡す
Oxlintは `oxlint [targets] [args]` を起動し、`--ignore` を繰り返しの `--ignore-pattern <ignore>` へ変換する
Oxfmtは `oxfmt --check [targets] [args]` を起動し、既定ではfileを書き換えずformatを検査する
Oxfmtは `--ignore` をskipと表示し、除外は `.oxfmtrc.json` とignore fileで指定する
BiomeとOxfmtを併用するときはformat対象を分け、このrepoではOxfmtをYAMLだけに使う
これらの外部engineはbaselineの対象にせず、終了codeを検査結果に使う

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
`rules` の直下には、rule名とgroup名を並べて書ける
rule名のkeyはそのruleだけへ、group名のkeyはengineが公開するruleのまとまりの全ruleへ、`off`、`on`、`warn`、`error` を渡す
ruleの設定と並べて渡すruleごとのoptionは、`{ "level": "on", "options": { "scope": "documented" } }` のようにobjectで書く
`level` を省略するとそのruleの状態を変えずoptionだけを重ね、groupへ渡したoptionはそれを受け取るruleにだけ効く
具体的な指定が勝つため、書く順にかかわらず preset、group、rule の順に重なる
`off` は既定で有効なruleにも渡せ、`on` はengineの既定severityのままにする
`warn` と `error` は全ての検出engineでruleの重大度を変更し、opt-inのruleは先に有効にする
engineが知らないgroup名やrule名、ruleが受け取らないoptionは設定errorになり、配布する `schema.json` がeditorへ同じ語彙を教える
選んだruleは同梱するengineへ直接渡すため、CLIは `--enable`、`--disable`、`--error` へは変換しない

### overrides

`overrides` は、globで選んだfileだけへ `rules` を重ねる
`files` は `includes` と同じglobで、否定globも書ける
`rules` はトップレベルの `rules` と同じ形で、書いた順に重なり、後の指定が勝つ

```json
{
  "tsdoc": {
    "rules": { "preset": "all" },
    "overrides": [
      { "files": ["tests/**"], "rules": { "missing-doc": "off" } },
      { "files": ["src/legacy/**"], "rules": { "completeness": "warn" } }
    ]
  }
}
```

`includes` で選ばれたfileだけが対象になり、`overrides` はfileを足さない
上書きは検出engineの起動前にfileごとのrule選択へ畳まれ、同じ選択になるfileは1回の起動にまとまる

検出engineはbaselineを持たないため、新規と解消済みの判定はengineごとではなく統合CLIが1つのbaseline fileで行う

`typecheck` は `projects` に並べたtsconfigごとに `tsc --noEmit -p <path>` を起動する
省略時はカレントの `tsconfig.json` を1回だけ読む

## Rules

外部engineの設定は [Oxlint](../../docs/engines/oxlint.md) と [Oxfmt](../../docs/engines/oxfmt.md) にある
そのruleとformatの設定は `quality.json.rules` ではなく、tool固有の設定fileで指定する

同梱するengineのrule語彙は import の無い内部module `rule-ids.ts` で定義し、packageの公開subpath exportsにはしない
設定とruleはengineごとに1つの文書へまとめる

| Engine | Group | 設定とrule |
|--------|-------|-----------|
| `code` | `spacing` | [`docs/engines/code.md`](../../docs/engines/code.md) |
| `comment` | `suppression`、`shape`、`content` | [`docs/engines/comment.md`](../../docs/engines/comment.md) |
| `markdown` | `whitespace`、`layout`、`consistency`、`japanese`、`content` | [`docs/engines/markdown.md`](../../docs/engines/markdown.md) |
| `tsdoc` | `correctness`、`suppressions`、`completeness`、`style` | [`docs/engines/tsdoc.md`](../../docs/engines/tsdoc.md) |

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

`quality-check migrate` は旧書式の `quality.json` を現在の書式へ移す
既定はpreviewで、`--write` を付けたときだけ書き換える
自動で直せない設定が1つでもあれば、`--write` を付けてもfileを書き換えず、手で直す箇所を出力して終了code 1にする
設定、baseline、抑制と検証記録の互換性は [engine名の移行と互換性](../../docs/engine-contract.md#engine名の移行と互換性) にある

```bash
quality-check migrate
quality-check migrate --write
quality-check migrate --from-v5 --write
```

`quality-check markdown <scan|check|lint>` は文書向けの個別コマンドを実行する
これらのactionが無ければ `markdown` はengine選択になり、`quality-check markdown` と `quality-check markdown docs` は統合runnerで実行する

```bash
quality-check markdown lint .
quality-check markdown lint --write .
quality-check markdown lint --preset all .
quality-check markdown scan doc.md --rules SKILL.md --review review.json
quality-check markdown check doc.md --rules SKILL.md --review review.json
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
| `markdown <command>` | 検証記録を実行する（`scan`、`check`、`lint`） |
| `migrate` | 旧書式の `quality.json` を移す（`--config <path>`、`--write`、`--from-v5`） |

`--ignore` と位置引数の対象pathは、その条件を受け取るengineへだけ渡す

### markdown

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
