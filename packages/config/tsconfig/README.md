[日本語](README.ja.md)

# @yuu1111/tsconfig

Shared TypeScript configurations.

## Install

```bash
bun add -D @yuu1111/tsconfig
```

## Usage

Extend one preset in your `tsconfig.json` and add the project settings the preset leaves out.

## Presets

| Preset | Use case |
|--------|----------|
| `base` | Strict shared base |
| `bun` | Bun projects |
| `declaration-only` | Declaration-only library builds |
| `library` | Library builds with declarations and source maps |
| `react` | React (JSX + DOM types) |

### base

```json
{
  "extends": "@yuu1111/tsconfig/base.json"
}
```

### bun

Install `@types/bun` in the consuming project.

```json
{
  "extends": "@yuu1111/tsconfig/bun.json"
}
```

### declaration-only

Use this preset when a bundler emits JavaScript and TypeScript only needs to emit declaration files.

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
