# @yuu1111/tsconfig

Shared TypeScript configurations.

## Install

```bash
bun add -D @yuu1111/tsconfig
```

## Usage

Extend one of the presets in your `tsconfig.json`:

### Node.js

```json
{
  "extends": "@yuu1111/tsconfig/node.json",
  "compilerOptions": {
    "outDir": "dist"
  }
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

### Base (custom setup)

```json
{
  "extends": "@yuu1111/tsconfig/base.json"
}
```

## Presets

| Preset | Use case |
|--------|----------|
| `base.json` | Strict shared base |
| `node.json` | Node.js (Node16 module resolution) |
| `react.json` | React (JSX + DOM types) |
