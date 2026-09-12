[English](README.md)

# @yuu1111/quality-check

Projectごとのscriptから個別に呼んでいたBiome、Knip、comment-check、document-style-check、TSDoc checkerを1つのCLIへまとめる baselineの差分判定もここで行う

## Install

```bash
bun add -D @yuu1111/quality-check
```

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
		knip: true,
		"comment-check": true,
		"document-style-check": true,
		"tsdoc-check": true,
	},
	config: {
		"comment-check": { ignore: ["FFXIVReplayAnalyzer"] },
		"tsdoc-check": { error: ["missing-doc"] },
	},
});
```

engineごとの出力と集約summaryを並べて出し、どのengineが失敗したかを1回の実行で示す

```text
== biome ==
Checked 128 files in 260ms. No fixes applied.
biome: passed (exit 0)

== comment-check ==
src/queue.ts:18:2 placeholder-comment placeholder comment should be resolved or tracked
comment-check: failed (1 new, 0 resolved, 0 warnings)

quality-check: 1 of 3 engines failed
  failed: comment-check
  passed: biome, tsdoc-check
```

## Config

| Field | Description |
|-------|-------------|
| `engines` | 起動するengine 値は `true` または `false` |
| `config` | engineごとの起動条件 |
| `baseline` | baseline fileのpath `false` なら差分判定を行わない |

engineは `biome` → `knip` → `comment-check` → `document-style-check` → `tsdoc-check` の順に実行する

`engines` は起動の委任だけを表し、起動条件は `config` のengineの下へ置く engineが受け取る条件は次のとおり

| engine | 受け取る条件 |
|--------|--------------|
| `biome` | `targets`、`args` 除外pathは `biome.json` が持つ |
| `knip` | `args` 設定は `knip.ts` が持つ |
| `comment-check` | `ignore`、`targets`、`args` |
| `document-style-check` | `ignore`、`targets`、`args` |
| `tsdoc-check` | `ignore`、`targets`、`args`、`error`（違反として扱うrule名） |

`args` はengineの既定引数の後ろへ足す 設定fileで表せない起動条件や、engineの引数が変わったときの逃げ道として使う

## Options

| Option | Description |
|--------|-------------|
| `--config <path>` | 読み込むconfig file（既定は `quality.config.ts`） |
| `--baseline <path>` | baseline fileを上書きする |
| `--ignore <path>` | 除外pathを追加する 複数指定できる |
| `--update-baseline` | 現在の検出でbaselineを置き換える |
| `--json` | engineごとの結果をJSONで出力する |

`--ignore` と位置引数の対象pathは、その条件を受け取るengineへだけ渡す

## Notes

終了codeは0が全engine成功、1が失敗したengineあり、2が設定またはengine起動の失敗

engineが受け取らない条件を書いた場合は渡さず、その旨をそのengineのsectionへ出す

```text
== biome ==
biome: ignore skipped (biome.json holds its settings)
```

BiomeとKnipの除外pathは `biome.json` と `knip.ts` が持つ このCLIは同じfileからengineの起動と結果の集約だけを行う

`comment-check` はbaseline差分を無効化する未作成のpathを渡して起動する 新規と解消済みの判定はengineごとではなく統合CLIが1つのbaseline fileで行うため、既存の `comment-baseline.json` がある場合は `--update-baseline` で移す

## License

MIT
