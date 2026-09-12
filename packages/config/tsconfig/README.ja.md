[English](README.md)

# @yuu1111/tsconfig

共有のTypeScript設定

## Install

```bash
bun add -D @yuu1111/tsconfig
```

## Usage

`tsconfig.json` でpresetの1つをextendsする

### Base

```json
{
  "extends": "@yuu1111/tsconfig/base.json"
}
```

### Bun

利用Projectで `@types/bun` をinstallしてからBun presetをextendsする

```json
{
  "extends": "@yuu1111/tsconfig/bun.json"
}
```

### Library

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

### Declaration-only library

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

### React

```json
{
  "extends": "@yuu1111/tsconfig/react.json",
  "compilerOptions": {
    "outDir": "dist"
  }
}
```

## Presets

| Preset | Use case |
|--------|----------|
| `base.json` | 厳格な共有base |
| `bun.json` | Bun project |
| `declaration-only.json` | declarationだけを出すlibrary build |
| `library.json` | declarationとsource mapを出すlibrary build |
| `react.json` | React（JSX + DOM型） |
