[English](README.md)

# @yuu1111/biome-config

共有の [Biome](https://biomejs.dev/) 設定

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

base設定はrecommended ruleを有効にし、barrel fileとre-export-allをerror、nested ternary、空block文、過剰なcognitive complexityをwarningにする

```ts
const size = small ? "s" : medium ? "m" : "l"
```

### React

CSS/Tailwind対応を含む

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "extends": ["@yuu1111/biome-config/react"]
}
```

### Custom rule presets

Custom ruleはopt-in baseまたはReact設定の後ろにpresetを1つ足す

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "extends": [
    "@yuu1111/biome-config/biome",
    "@yuu1111/biome-config/plugins/network"
  ]
}
```

Projectに必要な最も具体的なpresetを選ぶ

- `plugins/core` はforwarding export、未完成実装、型安全の迂回、安全でないerrno assertion、無意味なtest、pass-through wrapper、副作用目的のternaryを検査する
- `plugins/network` は `core` を含み、`fetch` に `AbortSignal` を要求し、手動で予約したabort timeoutの後始末を検査する
- `plugins/discord` は `network` を含み、動的なDiscord messageに明示的なmention処理があるかを検査する

親presetを別に並べない 子presetは親のruleを含む

#### Core rules

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

#### Network rule

- `require-fetch-abort-signal` は `fetch` 呼び出しが `signal` optionを省いているとwarningにする
- `require-abort-timeout-cleanup` は `setTimeout` callbackで `fetch` をabortしていながらそのtimerをclearしない関数をwarningにする

#### Discord rule

`no-unsafe-dynamic-discord-message` は明示的な `allowedMentions` policy無しで動的なmessage内容を送るとwarningにする

#### Project-scoped rule

`no-adapter-import` は `integrations/` か `adapters/` を含むpathをmoduleがimportするとerrorにする 保護する層がProject固有のためpresetを持たない Project自身の設定で宣言し、`includes` で絞る

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

pluginは `includes` に一致したfileだけで走るため、同じimportはadapter側と統合層へ到達してよい層では有効なままになる pluginのpatternはfileのfull pathと照合されるため、`src/modules/authorization` のようなpathへ一致させるには `**/` から始める必要がある

統合moduleへ到達してよい層はpatternから外す 自身のadapter実装を `adapters/` に置くmoduleはそのディレクトリを除外しないと、ruleがadapter自身を報告する

```json
{
	"includes": [
		"**/src/modules/authorization/**",
		"!**/src/modules/authorization/adapters/**"
	]
}
```

`no-direct-response` は対象層での `new Response(...)`、`Response.json(...)`、`Response.redirect(...)` をerrorにする すべてのresponseを共有helper経由で組み立てる層へ絞る

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

helper module自身はpatternの外に置くため、responseを組み立ててよい
