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
- `ignoreFiles` は `quality-check` が実行時に読み込む `quality.config.ts` を報告から外す

### application

- applicationのentry pointは公開契約ではないため `includeEntryExports` はoffのままにする

### library

- 公開APIから外れたexportを報告するため `includeEntryExports` をonにする

## Notes

動的なentry point、CLI binary、生成物は共有presetがProject構成から推測できないため利用Project側に残す

別Projectを同居させているrepositoryは `ignore` でそのProjectを報告から外し、親のsourceとして読ませない

```ts
import { application } from "@yuu1111/knip-config/application"

export default {
	...application,
	ignore: ["another-project/**"]
}
```
