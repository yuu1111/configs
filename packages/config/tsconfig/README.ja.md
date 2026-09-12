[English](README.md)

# @yuu1111/tsconfig

共有のTypeScript設定

## Install

```bash
bun add -D @yuu1111/tsconfig
```

## Usage

`tsconfig.json` でpresetを1つextendsし、presetが持たないProject設定を足す

## Presets

| Preset | 用途 |
|--------|------|
| `base` | 厳格な共有base |
| `bun` | Bun project |
| `declaration-only` | declarationだけを出すlibrary build |
| `library` | declarationとsource mapを出すlibrary build |
| `react` | React（JSX + DOM型） |

### base

```json
{
  "extends": "@yuu1111/tsconfig/base.json"
}
```

### bun

利用Projectで `@types/bun` をinstallする

```json
{
  "extends": "@yuu1111/tsconfig/bun.json"
}
```

### declaration-only

bundlerがJavaScriptを出し、TypeScriptはdeclaration fileだけを出す場合にこのpresetを使う

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

### library

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

### react

```json
{
  "extends": "@yuu1111/tsconfig/react.json",
  "compilerOptions": {
    "outDir": "dist"
  }
}
```
