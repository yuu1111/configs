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
| `entry` | `["quality.json"]` |
| `ignoreExportsUsedInFile` | `true` |
| `treatConfigHintsAsErrors` | `true` |
| `treatTagHintsAsErrors` | `true` |
`quality-check` は `quality.json` を実行時に読み込むため、このfileはentry pointとして扱われ未使用fileとして報告しない
利用側の公開APIは `quality-check` のAPIであり、このfileのexportではない
`treatConfigHintsAsErrors` は設定がProjectの実態と合わなくなったときに実行を失敗させる
`treatTagHintsAsErrors` は抑制しなくなったtagがあるときに実行を失敗させる

### application

applicationのentry pointは公開契約ではないため `includeEntryExports: false` を設定する

### library

公開APIから外れたexportを報告するため `includeEntryExports: true` を設定する

## Config

動的なentry point、CLI binary、生成物は共有presetがProject構成から推測できないため、利用Project側で足す

`entry` は利用Projectが書くと置き換わるため `quality.json` も並べる

```ts
export default {
	...application,
	entry: ["src/main.ts", "quality.json"]
}
```

`workspaces` を使う場合、`base` が足すtop levelの `entry` はroot workspaceへ届かないためroot workspace側へ移す
top levelの `entry` を残すとKnipがconfiguration hintを出し、`base` はhintをerrorとして扱うため実行が失敗する

```ts
import { application } from "@yuu1111/knip-config/application"

const { entry, ...base } = application

export default {
	...base,
	workspaces: {
		".": { entry },
		"packages/app": { entry: ["src/cli.ts"] }
	}
}
```

別Projectを同居させているrepositoryは `ignore` でそのProjectを報告から外し、親のsourceとして読ませない

```ts
export default {
	...application,
	ignore: ["another-project/**"]
}
```
