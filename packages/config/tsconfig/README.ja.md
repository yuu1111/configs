[English](README.md)

# @yuu1111/tsconfig

共有のTypeScript設定

## Install

```bash
bun add -D @yuu1111/tsconfig
```

## Usage

`tsconfig.json` でpresetを1つextendsし、presetが持たないpathをProjectで足す

```json
{
  "extends": "@yuu1111/tsconfig/base.json",
  "include": ["src/**/*.ts"]
}
```

## Presets

| Preset | Extends | 用途 |
|--------|---------|------|
| `base` | — | 他のpresetが継承する厳格なbase |
| `bun` | `base` | Bunのglobal型を足す |
| `library` | `base` | declarationとsource mapを出してJavaScriptをemitする |
| `declaration-only` | `library` | declaration fileだけを出す |
| `react` | `base` | DOM型とJSX transformを足す |

### base

他のpresetはすべて `base` をextendsする
emitせずに型検査だけを行い、emitはpresetまたはbundlerへ任せる

| Option | 値 |
|--------|-----|
| `target` | `ESNext` |
| `lib` | `["ESNext"]` |
| `module` | `Preserve` |
| `moduleResolution` | `bundler` |
| `moduleDetection` | `force` |
| `strict` | `true` |
| `noEmit` | `true` |
| `isolatedModules` | `true` |
| `verbatimModuleSyntax` | `true` |
| `esModuleInterop` | `true` |
| `resolveJsonModule` | `true` |
| `skipLibCheck` | `true` |
| `forceConsistentCasingInFileNames` | `true` |
| `noUncheckedIndexedAccess` | `true` |
| `noFallthroughCasesInSwitch` | `true` |
| `exactOptionalPropertyTypes` | `true` |

```json
{
  "extends": "@yuu1111/tsconfig/base.json"
}
```

### bun

`types: ["bun"]` を足す
利用Projectで `@types/bun` をinstallする

```json
{
  "extends": "@yuu1111/tsconfig/bun.json"
}
```

### library

emitを有効にし、declaration、declaration map、source mapを出す

| Option | 値 |
|--------|-----|
| `noEmit` | `false` |
| `declaration` | `true` |
| `declarationMap` | `true` |
| `sourceMap` | `true` |

```json
{
  "extends": "@yuu1111/tsconfig/library.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

### declaration-only

`library` をextendsし、bundlerがJavaScriptを出すbuild向けに `emitDeclarationOnly` を設定する

```json
{
  "extends": "@yuu1111/tsconfig/declaration-only.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

### react

`lib` へ `DOM` と `DOM.Iterable` を足し、`jsx: "react-jsx"` を設定する

```json
{
  "extends": "@yuu1111/tsconfig/react.json",
  "compilerOptions": {
    "outDir": "dist"
  }
}
```
