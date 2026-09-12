[English](README.md)

# @yuu1111/knip-config

共有の [Knip](https://knip.dev/) 設定

## Install

```bash
bun add -D @yuu1111/knip-config knip
```

## Usage

Knipは `knip.ts` を読むため、Projectに合うpresetをimportし、presetが推測できないentryを足す

```ts
import { application } from "@yuu1111/knip-config/application"

export default {
	...application,
	entry: ["src/main.ts"]
}
```

## Presets

| Preset | `includeEntryExports` | 用途 |
|--------|----------------------|------|
| `base` | — | 共有の既定値 |
| `application` | `false` | entry pointをframeworkが解決するapplication |
| `library` | `true` | entry pointが公開APIそのものであるlibrary |

### base

すべてのpresetが `base` をextendsする

| Setting | 値 |
|---------|-----|
| `entry` | `["quality.config.ts"]` |
| `ignoreExportsUsedInFile` | `true` |
| `ignoreIssues` | `{"quality.config.ts": ["exports"]}` |

`quality-check` は `quality.config.ts` を実行時に読み込むため、このfileはentry pointとして扱われ未使用fileとして報告しない
`ignoreIssues` はこのfileのexportを報告から外す
利用側の公開APIは `quality-check` のAPIであり、このfileのexportではない

### application

applicationのentry pointは公開契約ではないため `includeEntryExports: false` を設定する

### library

公開APIから外れたexportを報告するため `includeEntryExports: true` を設定する

## Config

動的なentry point、CLI binary、生成物は共有presetがProject構成から推測できないため、利用Project側で足す

`entry` は利用Projectが書くと置き換わるため `quality.config.ts` も並べる

```ts
export default {
	...application,
	entry: ["src/main.ts", "quality.config.ts"]
}
```

`workspaces` を使う場合、`base` が足すtop levelの `entry` はroot workspaceへ届かないためroot workspace側にも書く

```ts
export default {
	...application,
	workspaces: {
		".": { entry: ["quality.config.ts"] },
		"packages/app": { entry: ["src/cli.ts"] }
	}
}
```

`workspaces` を持つrepositoryがtop levelにも `entry` を書くとKnipがconfiguration hintを出す
報告ではないため終了codeは変わらない

別Projectを同居させているrepositoryは `ignore` でそのProjectを報告から外し、親のsourceとして読ませない

```ts
export default {
	...application,
	ignore: ["another-project/**"]
}
```
