[日本語](README.ja.md)

# @yuu1111/biome-config

Shared [Biome](https://biomejs.dev/) configuration.

## Install

```bash
bun add -D @yuu1111/biome-config
```

## Usage

Extend `biome` and add the rule layers the project needs:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "extends": [
    "@yuu1111/biome-config/biome",
    "@yuu1111/biome-config/plugins/core"
  ]
}
```

## Presets

| Preset | Use case |
|--------|----------|
| `biome` | Formatter, lint rules, and VCS integration |
| `react` | `biome` plus CSS and Tailwind |
| `plugins/core` | Seven general-purpose rule plugins |
| `plugins/network` | Two `fetch` rule plugins |
| `plugins/discord` | One Discord rule plugin |

`biome` and `react` are complete configurations.
The `plugins/*` presets only add rules, so list them after `biome` or `react`; their rules are off until the preset is extended.

### biome

| Setting | Value |
|---------|-------|
| `vcs` | git, `useIgnoreFile` |
| `formatter` | enabled, `indentStyle: "tab"` |
| `javascript.formatter.quoteStyle` | `double` |
| `json.formatter.expand` | `always` |
| `assist.source.organizeImports` | `on` |
| `linter.rules.recommended` | `true` |
| `performance.noBarrelFile`, `performance.noReExportAll` | `error` |
| `complexity.noExcessiveCognitiveComplexity` | `warn` |
| `style.noNestedTernary` | `warn` |
| `suspicious.noEmptyBlockStatements` | `warn` |

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "extends": ["@yuu1111/biome-config/biome"]
}
```

### react

Adds the CSS formatter and linter, with the Tailwind directives enabled.

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "extends": ["@yuu1111/biome-config/react"]
}
```

### plugins/core

| Rule | Severity | Default | Detects |
|------|----------|---------|---------|
| `no-reexports` | warn | false | An export that only forwards an existing binding, such as `export type Alias = Imported` or `export default imported`; the `export ... from` forms are covered by the base barrel-file rules |
| `no-incomplete-implementation` | error, warn | false | A placeholder throw, as an error; a catch block that only logs, or a rejected promise or caught error replaced with `null`, `[]`, or `{}`, as a warning |
| `no-type-safety-bypass` | error, warn | false | `as unknown as T`, as an error; a `Record<string, unknown>` assertion, an unchecked JSON assertion, static `Reflect.get`, or a receiver-free `Reflect.apply`, as a warning |
| `no-unsafe-errno-assertion` | warn | false | Reading `code` through a `NodeJS.ErrnoException` assertion without validating the caught value |
| `no-meaningless-test` | error, warn | false | A `toBe`, `toEqual`, or `toStrictEqual` comparison of an identifier or literal with itself, as an error; an empty `test` or `it` callback, as a warning |
| `no-useless-abstraction` | warn | false | A named single-argument arrow function that only passes the same argument to another function, including the async form |
| `no-ternary-statement` | warn | false | A ternary operator used as a standalone statement, such as `flag ? enable() : disable()` |

The rules stay narrow.
A wrapper that validates, transforms, logs, caches, starts a transaction, or performs another operation is not reported as a pass-through wrapper.
A test with setup or assertions is not treated as empty.

```ts
throw new Error("Not implemented")
request.catch(() => null)

const user = value as unknown as User
const parsed = JSON.parse(text) as User
const code = (error as NodeJS.ErrnoException).code

test("placeholder", () => {})
expect(result).toEqual(result)

const loadUser = (id) => fetchUser(id)

flag ? enable() : disable()
```

Suppress an intentional exception with a reason:

```ts
// biome-ignore lint/plugin: An optional cache miss is an expected fallback
cacheRequest.catch(() => null)
```

### plugins/network

| Rule | Severity | Default | Detects |
|------|----------|---------|---------|
| `require-fetch-abort-signal` | warn | false | A `fetch` call that omits the `signal` option |
| `require-abort-timeout-cleanup` | warn | false | A function that aborts a `fetch` request from a `setTimeout` callback but never clears the timer |

### plugins/discord

| Rule | Severity | Default | Detects |
|------|----------|---------|---------|
| `no-unsafe-dynamic-discord-message` | warn | false | Dynamic message content sent without an explicit `allowedMentions` policy |

## Scoped rules

| Rule | Severity | Default | Detects |
|------|----------|---------|---------|
| `no-adapter-import` | error | false | An import of a path that contains `integrations/` or `adapters/` |
| `no-direct-response` | error | false | `new Response(...)`, `Response.json(...)`, or `Response.redirect(...)` in the scoped layer |

They need `includes` to name the layer they protect, so a shared preset cannot carry them.
Declare them in the project's own configuration.

### no-adapter-import

```json
{
  "plugins": [
    {
      "path": "./node_modules/@yuu1111/biome-config/plugins/scoped/no-adapter-import.grit",
      "includes": ["**/src/modules/authorization/**"]
    }
  ]
}
```

The plugin runs only on the files that match `includes`, so the same import stays valid in the adapters and in the layers that are allowed to reach them.
A plugin pattern is matched against the full file path, so it has to start with `**/` to match a path such as `src/modules/authorization`.

Biome resolves a plugin `path` as a file path, so reference the rule through `node_modules` as shown above.
A package specifier such as `@yuu1111/biome-config/plugins/scoped/no-adapter-import.grit` is resolved as a plugin package instead.

Leave the layer that is allowed to reach the integration modules out of the pattern.
A module that keeps its own adapter implementations under an `adapters/` directory has to exclude that directory, or the rule reports the adapters themselves:

```json
{
  "includes": [
    "**/src/modules/authorization/**",
    "!**/src/modules/authorization/adapters/**"
  ]
}
```

### no-direct-response

```json
{
  "plugins": [
    {
      "path": "./node_modules/@yuu1111/biome-config/plugins/scoped/no-direct-response.grit",
      "includes": ["**/src/worker/routes/**"]
    }
  ]
}
```

The helper module itself stays outside the pattern, so it can still construct responses.
