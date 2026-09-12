[English](README.md)

# @yuu1111/knip-config

共有の [Knip](https://knip.dev/) 設定

## Install

```bash
bun add -D @yuu1111/knip-config knip
```

## Usage

Knipは `knip.ts` を読むため、Projectに合うpresetをimportしてProject固有のentryを足す

```ts
import { application } from "@yuu1111/knip-config/application"

export default {
	...application,
	entry: ["src/main.ts"]
}
```

## Presets

| Preset | Use case |
|--------|----------|
| `base` | 共有の既定値 |
| `application` | entry pointをframeworkが解決するapplication |
| `library` | entry pointが公開APIそのものであるlibrary |

### base

- `ignoreExportsUsedInFile` は自分のfile内だけで参照されるexportを報告から外す
- `entry` は `quality-check` が実行時に読み込む `quality.config.ts` をentry pointとして扱う 未使用fileとして報告せず、このfileがimportするexportも利用中とみなす
- `ignoreIssues` は `quality.config.ts` 自身のexportを報告から外す 利用側の入口は `quality-check` のAPIであり、このfileのexportではない

### application

- applicationのentry pointは公開契約ではないため `includeEntryExports` はoffのままにする

### library

- 公開APIから外れたexportを報告するため `includeEntryExports` をonにする

## Notes

動的なentry point、CLI binary、生成物は共有presetがProject構成から推測できないため利用Project側に残す

`base` が足す `entry` は、利用Projectが `entry` を書くと置き換わる 自分のentryを足すときは `quality.config.ts` も並べる

```ts
export default {
	...application,
	entry: ["src/main.ts", "quality.config.ts"]
}
```

別Projectを同居させているrepositoryは `ignore` でそのProjectを報告から外し、親のsourceとして読ませない

```ts
import { application } from "@yuu1111/knip-config/application"

export default {
	...application,
	ignore: ["another-project/**"]
}
```

`workspaces` を持つrepositoryで `entry` をtop levelに書くとKnipがconfiguration hintを出す 報告ではないため終了codeは変わらない
