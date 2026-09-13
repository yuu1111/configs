[English](README.md)

# @yuu1111/quality-check

Projectごとのscriptから個別に呼んでいたBiome、型検査、Knip、code-style-check、comment-check、document-style-check、TSDoc checkerを1つのCLIへまとめる baselineの差分判定もここで行う

## Install

```bash
bun add -D @yuu1111/quality-check
```

このCLIは `comment-check`、`document-style-check`、`tsdoc-check` を、configの型がengineの公開するrule名を取り込むためpeer dependencyとして持つ
package managerはこのCLIと一緒に導入し、engineのbinaryは利用Projectの `node_modules/.bin` から実行時に解決する

`@yuu1111/code-style-check` を宣言するProjectではKnipが未使用依存として報告するため `knip.ts` の `ignoreDependencies` で理由付きに宣言する

## Usage

`quality.config.ts` で起動するengineとengineごとの起動条件を指定し、scriptから起動する

```json
{
  "scripts": {
    "check:quality": "quality-check"
  }
}
```

```ts
import { defineConfig } from "@yuu1111/quality-check";

export default defineConfig({
	engines: {
		biome: true,
		typecheck: true,
		knip: true,
		"code-style-check": true,
		"comment-check": true,
		"document-style-check": true,
		"tsdoc-check": true,
	},
	config: {
		"comment-check": {
			enable: ["japanese-period"],
			ignore: ["another-project"],
		},
		"document-style-check": {
			enable: ["japanese-period"],
		},
		"tsdoc-check": {
			error: ["missing-doc"],
		},
	},
});
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

## Config

| Field | 説明 |
|-------|-------------|
| `engines` | 起動するengine、値は `true` または `false` |
| `config` | engineごとの起動条件 |
| `baseline` | baseline fileのpath `false` なら差分判定を行わない |

engineは `biome` → `typecheck` → `knip` → `code-style-check` → `comment-check` → `document-style-check` → `tsdoc-check` の順に実行する

`engines` は起動の委任だけを表し、起動条件は `config` のengineの下へ置く engineごとの条件は複数行のobjectとして書き、ruleやoptionを足しても他のengineの行が動かないようにする engineが受け取る条件は次のとおり

| Engine | Command | 条件 |
|--------|-----------------|--------------|
| `biome` | `biome check` | `targets`、`args` 除外pathは `biome.json` が持つ |
| `typecheck` | `tsc --noEmit` | `args`、`projects` 設定は `tsconfig.json` が持つ |
| `knip` | `knip` | `args` 設定は `knip.ts` が持つ |
| `code-style-check` | `code-style-check --json` | `ignore`、`targets`、`args` |
| `comment-check` | `comment-check --json` | `ignore`、`targets`、`args`、`enable`（有効にするrule名） |
| `document-style-check` | `document-style-check lint --json` | `ignore`、`targets`、`args`、`enable`（有効にするrule名） |
| `tsdoc-check` | `tsdoc-check --json` | `ignore`、`targets`、`args`、`enable`（有効にするrule名）、`error`（違反として扱うrule名） |

`args` はengineの既定引数の後ろへ足す
設定fileで表せない起動条件や、engineの引数が変わったときの逃げ道として使う

engineが受け取らない条件は渡さず、その旨をそのengineのsectionへ出す

```text
== biome ==
biome: ignore skipped (biome.json holds its settings)
```

`enable` は `comment-check` と `document-style-check` と `tsdoc-check` の `--enable <rule>` になり、他のengineでは拒否される
値は導入済みengineが `rule-ids` で公開するrule名で型付けするため、engineが知らない名前は起動時の失敗ではなく型errorになる

`comment-check` はbaseline差分を無効化する未作成のpathを渡して起動する
新規と解消済みの判定はengineごとではなく統合CLIが1つのbaseline fileで行うため、既存の `comment-baseline.json` がある場合は `--update-baseline` で移す

`typecheck` は `projects` に並べたtsconfigごとに `tsc --noEmit -p <path>` を起動する
省略時はカレントの `tsconfig.json` を1回だけ読む

## Options

| Option | 説明 |
|--------|-------------|
| `--config <path>` | 読み込むconfig file（既定は `quality.config.ts`） |
| `--baseline <path>` | baseline fileを上書きする |
| `--ignore <path>` | 除外pathを追加する、複数指定できる |
| `--update-baseline` | 現在の検出でbaselineを置き換える |
| `--json` | engineごとの結果をJSONで出力する |

`--ignore` と位置引数の対象pathは、その条件を受け取るengineへだけ渡す

色は標準出力が端末のときだけ付ける `NO_COLOR` で無効にし、`FORCE_COLOR` で強制できる `--json` の出力には付けない
