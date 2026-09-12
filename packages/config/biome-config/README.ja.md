[English](README.md)

# @yuu1111/biome-config

共有の [Biome](https://biomejs.dev/) 設定

## Install

```bash
bun add -D @yuu1111/biome-config
```

## Usage

### base

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "extends": ["@yuu1111/biome-config/biome"]
}
```

base設定はrecommended ruleを有効にし、barrel fileとre-export-allをerror、nested ternary、空block文、過剰なcognitive complexityをwarningにする

```ts
const size = small ? "s" : medium ? "m" : "l"
```

### react

CSS/Tailwind対応を含む

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "extends": ["@yuu1111/biome-config/react"]
}
```

## Presets

Custom ruleはopt-in baseまたはReact設定の後ろに、必要な層のpresetを並べる

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "extends": [
    "@yuu1111/biome-config/biome",
    "@yuu1111/biome-config/plugins/core",
    "@yuu1111/biome-config/plugins/network"
  ]
}
```

| Preset | rule |
|--------|------|
| `plugins/core` | forwarding export、未完成実装、型安全の迂回、安全でないerrno assertion、無意味なtest、pass-through wrapper、副作用目的のternary |
| `plugins/network` | `fetch` への `AbortSignal` 要求と、手動で予約したabort timeoutの後始末 |
| `plugins/discord` | 動的なDiscord messageの明示的なmention処理 |

presetは他の層を含まないため、Projectに必要な層をすべて並べる [Project固有のrule](#project固有のrule)はpresetではない 対象層を選ぶ `includes` を共有presetは持てないため、Project自身の設定で宣言する

### core

- `no-reexports` は既存bindingを転送するだけのexport（`export type Alias = Imported`、`export default imported`、`export const wrapped = imported` など）をwarningにする `export ... from` の形はbaseのbarrel file ruleが担当する
- `no-incomplete-implementation` はplaceholderのthrowをerror、logだけのcatch、`null`・`[]`・`{}` へ置き換えたrejected promiseとcatchしたerrorをwarningにする
- `no-type-safety-bypass` は `as unknown as T` をerror、`Record<string, unknown>` のassertion、未検証のJSON assertion、静的な `Reflect.get`、receiver無しの `Reflect.apply` をwarningにする
- `no-unsafe-errno-assertion` はcatchした値を検証せず `NodeJS.ErrnoException` のassertion経由で `code` を直接読むコードをwarningにする
- `no-meaningless-test` はidentifierやliteralを自分自身と比較する `toBe`・`toEqual`・`toStrictEqual` をerror、空の `test`・`it` callbackをwarningにする
- `no-useless-abstraction` は同じ引数を別の関数へ渡すだけの名前付き単一引数arrow functionをwarningにする 同じ形のasync版も含む
- `no-ternary-statement` は `flag ? enable() : disable()` のような文としてのternaryをwarningにする if/elseの方が明確な箇所が対象

ruleは意図的に狭く保つ 検証、変換、log、cache、transaction開始などの処理を行うwrapperはpass-through wrapperとして報告しない 準備やassertionのあるtestは空として扱わない

`plugins/core` が報告する例

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

理由を添えて意図的な例外を抑制する

```ts
// biome-ignore lint/plugin: An optional cache miss is an expected fallback
cacheRequest.catch(() => null)
```

### network

- `require-fetch-abort-signal` は `fetch` 呼び出しが `signal` optionを省いているとwarningにする
- `require-abort-timeout-cleanup` は `setTimeout` callbackで `fetch` をabortしていながらそのtimerをclearしない関数をwarningにする

### discord

`no-unsafe-dynamic-discord-message` は明示的な `allowedMentions` policy無しで動的なmessage内容を送るとwarningにする

## Project固有のrule

### no-adapter-import

`no-adapter-import` は `integrations/` か `adapters/` を含むpathをmoduleがimportするとerrorにする Project自身の設定で宣言し、`includes` で絞る

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

pluginは `includes` に一致したfileだけで走るため、同じimportはadapter側と統合層へ到達してよい層では有効なままになる pluginのpatternはfileのfull pathと照合されるため、`src/modules/authorization` のようなpathへ一致させるには `**/` から始める必要がある

pluginの `path` はfile pathとして解決されるため、上記のように `node_modules` 経由で参照する package specifierはplugin packageとして解決され、`.grit` fileを指せない

統合moduleへ到達してよい層はpatternから外す 自身のadapter実装を `adapters/` に置くmoduleはそのディレクトリを除外しないと、ruleがadapter自身を報告する

```json
{
  "includes": [
    "**/src/modules/authorization/**",
    "!**/src/modules/authorization/adapters/**"
  ]
}
```

### no-direct-response

`no-direct-response` は対象層での `new Response(...)`、`Response.json(...)`、`Response.redirect(...)` をerrorにする すべてのresponseを共有helper経由で組み立てる層へ絞る

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

helper module自身はpatternの外に置くため、responseを組み立ててよい
