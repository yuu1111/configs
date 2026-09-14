# プロジェクトへの導入

この repo の package を1つのプロジェクトへ導入する順序を示す
各 package の preset と option は package README を正本にし、ここでは組み合わせ方だけを扱う

## packageを入れる

| Package | 用途 |
|---------|------|
| [`@yuu1111/tsconfig`](../packages/config/tsconfig/README.md) | TypeScriptの共有設定 |
| [`@yuu1111/biome-config`](../packages/config/biome-config/README.md) | Biomeの共有設定 |
| [`@yuu1111/knip-config`](../packages/config/knip-config/README.md) | Knipの共有設定 |
| [`@yuu1111/quality-check`](../packages/engine/quality-check/README.md) | 検査engineをまとめて起動するCLI |

`quality-check` は Biome、`tsc`、Knip を子プロセスとして起動するため、その本体も入れる

```bash
bun add -D @biomejs/biome knip typescript
bun add -D @yuu1111/biome-config @yuu1111/knip-config @yuu1111/quality-check @yuu1111/tsconfig
```

## 共有設定を継承する

### tsconfig.json

```json
{
  "extends": "@yuu1111/tsconfig/base.json",
  "include": ["src/**/*.ts"]
}
```

### biome.json

```json
{
  "extends": ["@yuu1111/biome-config/biome"]
}
```

### knip.ts

```ts
import { application } from "@yuu1111/knip-config/application"

export default {
	...application,
	entry: ["src/main.ts"]
}
```

## quality.jsonを書く

```json
{
  "$schema": "./node_modules/@yuu1111/quality-check/schema.json",
  "biome": {
    "enabled": true
  },
  "typecheck": {
    "enabled": true
  },
  "knip": {
    "enabled": true
  },
  "document-style-check": {
    "enabled": true,
    "targets": ["docs"],
    "rules": {
      "preset": "recommended"
    }
  },
  "failOnWarnings": true
}
```

engine ごとの設定とruleは [`docs/engines/`](engines) を正本にする
導入時は `preset` の `recommended` で始め、opt-inのruleを `on` で1つずつ足す

```json
{
  "document-style-check": {
    "rules": {
      "preset": "recommended",
      "typography": {
        "japanese-period": "on"
      }
    }
  }
}
```

## scriptへ登録する

```json
{
  "scripts": {
    "check:quality": "quality-check"
  }
}
```

終了codeは0が全engine通過、1が1つ以上の検出、2が設定かengineの起動失敗になる

## 既存の検出をbaselineへ記録する

既存のtreeへ導入すると、その時点の検出がすべて失敗として出る
`quality-baseline.json` を1度作ると、後から足した検出だけが失敗する

```bash
quality-check --update-baseline
```

baselineは engine 名、rule、file、message で1件を識別する
messageを変えるとそのruleの記録は一致しなくなるため、検出を直すかbaselineを作り直す

## CIで実行する

```yaml
name: quality
on:
  pull_request:
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run check:quality
```
