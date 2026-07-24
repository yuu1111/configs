# @yuu1111/tsconfig

Shared TypeScript configurations.

## Install

```bash
bun add -D @yuu1111/tsconfig
```

## Usage

Extend one of the presets in your `tsconfig.json`:

### Base

```json
{
  "extends": "@yuu1111/tsconfig/base.json"
}
```

### Bun

Install `@types/bun` in the consuming project, then extend the Bun preset:

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

Use this preset when a bundler emits JavaScript and TypeScript only needs to emit
declaration files.

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
| `base.json` | Strict shared base |
| `bun.json` | Bun projects |
| `declaration-only.json` | Declaration-only library builds |
| `library.json` | Library builds with declarations and source maps |
| `react.json` | React (JSX + DOM types) |
