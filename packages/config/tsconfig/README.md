[日本語](README.ja.md)

# @yuu1111/tsconfig

Shared TypeScript configurations.

## Install

```bash
bun add -D @yuu1111/tsconfig
```

## Usage

Extend one preset in `tsconfig.json` and add the paths it leaves to the project.

```json
{
  "extends": "@yuu1111/tsconfig/base.json",
  "include": ["src/**/*.ts"]
}
```

## Presets

| Preset | Extends | Use case |
|--------|---------|----------|
| `base` | — | Strict baseline shared by the other presets |
| `bun` | `base` | Adds the Bun global types |
| `library` | `base` | Emits JavaScript with declarations and source maps |
| `declaration-only` | `library` | Emits declaration files only |
| `react` | `base` | Adds the DOM types and the JSX transform |

### base

Every other preset extends `base`.
It checks types without emitting, and leaves the emit to the preset or the bundler.

| Option | Value |
|--------|-------|
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

Adds `types: ["bun"]`. Install `@types/bun` in the project.

```json
{
  "extends": "@yuu1111/tsconfig/bun.json"
}
```

### library

Turns emit on and writes declarations, declaration maps, and source maps.

| Option | Value |
|--------|-------|
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

Extends `library` and sets `emitDeclarationOnly`, for a build where a bundler emits the JavaScript.

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

Adds `DOM` and `DOM.Iterable` to `lib` and sets `jsx: "react-jsx"`.

```json
{
  "extends": "@yuu1111/tsconfig/react.json",
  "compilerOptions": {
    "outDir": "dist"
  }
}
```
