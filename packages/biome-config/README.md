[日本語](README.ja.md)

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
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "extends": ["@yuu1111/biome-config/biome"]
}
```

The base configuration enables the recommended rules, errors on barrel files and re-export-all, and warns about nested ternaries, empty block statements, and excessive cognitive complexity:

```ts
const size = small ? "s" : medium ? "m" : "l"
```

### React

CSS/Tailwind support included.

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "extends": ["@yuu1111/biome-config/react"]
}
```

### Custom rule presets

Custom rules are opt-in. Add one preset after the base or React configuration:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "extends": [
    "@yuu1111/biome-config/biome",
    "@yuu1111/biome-config/plugins/network"
  ]
}
```

Choose the most specific preset needed by the project:

- `plugins/core` checks forwarding exports, incomplete implementations, type-safety bypasses, unsafe errno assertions, meaningless tests, pass-through wrappers, and ternaries used for side effects
- `plugins/network` includes `core`, requires an `AbortSignal` for `fetch`, and checks cleanup for manually scheduled abort timeouts
- `plugins/discord` includes `network` and checks dynamic Discord messages for explicit mention handling

Do not list parent presets separately. Each child preset includes its parent rules.

#### Core rules

- `no-reexports` warns about exports that only forward an existing binding, such as `export type Alias = Imported`, `export default imported`, or `export const wrapped = imported`; the `export ... from` forms are covered by the base barrel-file rules
- `no-incomplete-implementation` errors on placeholder throws and warns about catch blocks that only log, and rejected promises or caught errors replaced with `null`, `[]`, or `{}`
- `no-type-safety-bypass` errors on `as unknown as T` and warns about `Record<string, unknown>` assertions, unchecked JSON assertions, static `Reflect.get`, and receiver-free `Reflect.apply`
- `no-unsafe-errno-assertion` warns when code reads `code` directly through a `NodeJS.ErrnoException` assertion without validating the caught value
- `no-meaningless-test` errors on `toBe`, `toEqual`, or `toStrictEqual` comparisons where an identifier or literal is compared with itself, and warns about empty `test` or `it` callbacks
- `no-useless-abstraction` warns about named single-argument arrow functions that only pass the same argument to another function, including the equivalent async form
- `no-ternary-statement` warns when a ternary operator is used as a standalone statement, such as `flag ? enable() : disable()`, where an if/else statement is clearer

The rules intentionally stay narrow. A wrapper that validates, transforms, logs, caches, starts a transaction, or performs another operation is not reported as a pass-through wrapper. Tests with setup or assertions are not treated as empty.

Examples reported by `plugins/core`:

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

#### Network rule

- `require-fetch-abort-signal` warns when a `fetch` call omits the `signal` option
- `require-abort-timeout-cleanup` warns when a function uses a `setTimeout` callback to abort a `fetch` request but does not clear that timer

#### Discord rule

`no-unsafe-dynamic-discord-message` warns when dynamic message content is sent without an explicit `allowedMentions` policy.

#### Project-scoped rule

`no-adapter-import` errors when a module imports a path that contains `integrations/` or `adapters/`. It has no preset because the layer it protects is specific to the project. Declare it in the project's own configuration and narrow it with `includes`:

```json
{
	"plugins": [
		{
			"path": "./node_modules/@yuu1111/biome-config/plugins/no-adapter-import.grit",
			"includes": ["**/src/modules/authorization/**"]
		}
	]
}
```

The plugin runs only on the files that match `includes`, so the same import stays valid in the adapters and in the layers that are allowed to reach them. A plugin pattern is matched against the full file path, so it has to start with `**/` to match a path such as `src/modules/authorization`.

Leave the layer that is allowed to reach the integration modules out of the pattern. A module that keeps its own adapter implementations under an `adapters/` directory has to exclude that directory, or the rule reports the adapters themselves:

```json
{
	"includes": [
		"**/src/modules/authorization/**",
		"!**/src/modules/authorization/adapters/**"
	]
}
```

`no-direct-response` errors on `new Response(...)`, `Response.json(...)` and `Response.redirect(...)` inside the scoped layer. Scope it to the layer that has to build every response through the shared helper:

```json
{
	"plugins": [
		{
			"path": "./node_modules/@yuu1111/biome-config/plugins/no-direct-response.grit",
			"includes": ["**/src/worker/routes/**"]
		}
	]
}
```

The helper module itself stays outside the pattern, so it can still construct responses.
