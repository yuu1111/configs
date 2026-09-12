[English](README.md)

# @yuu1111/quality-check

Projectごとのscriptから個別に呼んでいたBiome、Knip、comment-check、TSDoc checkerを1つのCLIへまとめる baselineの差分判定もここで行う

## Install

```bash
bun add -D @yuu1111/quality-check
```

## Usage

`quality.config.ts` でengineと除外pathを指定し、scriptから起動する

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
    "tsdoc-check": { args: ["--error", "missing-doc"] },
  },
  ignore: ["FFXIVReplayAnalyzer"],
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
| `engines` | 起動するengine 値は `true` または `{ args }` |
| `ignore` | file走査engineが検査から外すpath |
| `baseline` | baseline fileのpath `false` なら差分判定を行わない |
| `targets` | file走査engineへ渡す対象path |

engineは `biome` → `knip` → `comment-check` → `tsdoc-check` の順に実行する
`args` はengineの既定引数の後ろへ足すため、`tsdoc-check` の `--error` のようなengine固有の指定はここへ置く

## Options

| Option | Description |
|--------|-------------|
| `--config <path>` | 読み込むconfig file（既定は `quality.config.ts`） |
| `--baseline <path>` | baseline fileを上書きする |
| `--ignore <path>` | 除外pathを追加する 複数指定できる |
| `--update-baseline` | 現在の検出でbaselineを置き換える |
| `--json` | engineごとの結果をJSONで出力する |

## Notes

終了codeは0が全engine成功、1が失敗したengineあり、2が設定またはengine起動の失敗

BiomeとKnipは除外pathを自分のconfig（`biome.json`、`knip.ts`）で持つ `ignore` はfile走査engineへ `--ignore` として渡し、BiomeとKnipには渡さない

`comment-check` はbaseline差分を無効化する未作成のpathを渡して起動する 新規と解消済みの判定はengineごとではなく統合CLIが1つのbaseline fileで行うため、既存の `comment-baseline.json` がある場合は `--update-baseline` で移す

## License

MIT
