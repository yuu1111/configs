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
| `react.json` | React (JSX + DOM types) |
