# @yuu1111/biome-config

Shared [Biome](https://biomejs.dev/) configuration.

## Install

```bash
bun add -D @yuu1111/biome-config
```

## Usage

### Base

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.14/schema.json",
  "extends": ["@yuu1111/biome-config/biome"]
}
```

### React

CSS/Tailwind support included.

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.14/schema.json",
  "extends": ["@yuu1111/biome-config/react"]
}
```

### Custom rule presets

Custom rules are opt-in. Add one preset after the base or React configuration:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.14/schema.json",
  "extends": [
    "@yuu1111/biome-config/biome",
    "@yuu1111/biome-config/plugins/network"
  ]
}
```

Choose the most specific preset needed by the project:

- `plugins/core` prohibits re-exports and unchecked JSON type assertions
- `plugins/network` includes `core` and requires an `AbortSignal` for `fetch`
- `plugins/discord` includes `network` and checks dynamic Discord messages for explicit mention handling

Do not list parent presets separately. Each child preset includes its parent rules.
