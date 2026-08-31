# @yuu1111/biome-config

Shared [Biome](https://biomejs.dev/) configuration.

## Install

```bash
bun add -D @yuu1111/biome-config
```

## Usage

### Base

Includes a plugin that prohibits re-exports. Export declarations must define their
value or type directly instead of forwarding another declaration.

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "extends": ["@yuu1111/biome-config/biome"]
}
```

### React

CSS/Tailwind support included.

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "extends": ["@yuu1111/biome-config/react"]
}
```
