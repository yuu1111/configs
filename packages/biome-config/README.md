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

- `plugins/core` checks re-exports, incomplete implementations, type-safety bypasses, unsafe errno assertions, meaningless tests, and pass-through wrappers
- `plugins/network` includes `core`, requires an `AbortSignal` for `fetch`, and checks cleanup for manually scheduled abort timeouts
- `plugins/discord` includes `network` and checks dynamic Discord messages for explicit mention handling

Do not list parent presets separately. Each child preset includes its parent rules.

#### Core rules

- `no-reexports` prohibits exports that only forward an imported symbol or module
- `no-incomplete-implementation` warns about placeholder throws, catch blocks that only log, and rejected promises or caught errors replaced with `null`, `[]`, or `{}`
- `no-type-safety-bypass` warns about `as unknown as T`, `Record<string, unknown>` assertions, unchecked JSON assertions, static `Reflect.get`, and receiver-free `Reflect.apply`
- `no-unsafe-errno-assertion` warns when code reads `code` directly through a `NodeJS.ErrnoException` assertion without validating the caught value
- `no-meaningless-test` warns about empty `test` or `it` callbacks and `toBe`, `toEqual`, or `toStrictEqual` comparisons where an identifier or literal is compared with itself
- `no-useless-abstraction` warns about named single-argument arrow functions that only pass the same argument to another function, including the equivalent async form

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
