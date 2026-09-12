[English](README.md)

# @yuu1111/biome-config

共有の [Biome](https://biomejs.dev/) 設定

## Install

```bash
bun add -D @yuu1111/biome-config
```

## Usage

`biome` をextendsし、Projectに必要なrule層を足す

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

| Preset | 用途 |
|--------|------|
| `biome` | formatter、lint rule、VCS連携 |
| `react` | `biome` にCSSとTailwindを足す |
| `plugins/core` | 汎用のrule plugin 7つ |
| `plugins/network` | `fetch` のrule plugin 2つ |
| `plugins/discord` | Discordのrule plugin 1つ |

`biome` と `react` は完結した設定で、`plugins/*` はruleだけを足す
`biome` か `react` の後ろへ並べ、presetをextendsするまでそれぞれのruleは無効になる

### biome

| Setting | 値 |
|---------|-----|
| `vcs` | git、`useIgnoreFile` |
| `formatter` | 有効、`indentStyle: "tab"` |
| `javascript.formatter.quoteStyle` | `double` |
| `json.formatter.expand` | `always` |
| `assist.source.organizeImports` | `on` |
| `linter.rules.recommended` | `true` |
| `nursery.noFloatingPromises` | `warn` |
| `performance.noBarrelFile`、`performance.noReExportAll` | `error` |
| `complexity.noExcessiveCognitiveComplexity` | `warn` |
| `style.noNestedTernary`、`style.useErrorCause` | `warn` |
| `suspicious.noEmptyBlockStatements` | `warn` |

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "extends": ["@yuu1111/biome-config/biome"]
}
```

### react

CSSのformatterとlinterを足し、Tailwind directiveを有効にする

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "extends": ["@yuu1111/biome-config/react"]
}
```

### plugins/core

| Rule | 重大度 | Default | 検出対象 |
|------|----------|---------|---------|
| `no-reexports` | warn | false | 既存bindingを転送するだけのexport（`export type Alias = Imported` など）、`export ... from` の形はbaseのbarrel file ruleが担当する |
| `no-incomplete-implementation` | error, warn | false | placeholderのthrowはerror、logだけのcatch、`null`・`[]`・`{}` へ置き換えたrejected promiseとcatchしたerrorはwarn |
| `no-type-safety-bypass` | error, warn | false | `as unknown as T` はerror、`Record<string, unknown>` のassertion、未検証のJSON assertion、静的な `Reflect.get`、receiver無しの `Reflect.apply` はwarn |
| `no-unsafe-errno-assertion` | warn | false | catchした値を検証せず `NodeJS.ErrnoException` のassertion経由で `code` を読むコード |
| `no-meaningless-test` | error, warn | false | identifierやliteralを自分自身と比較する `toBe`・`toEqual`・`toStrictEqual` はerror、空の `test`・`it` callbackはwarn |
| `no-useless-abstraction` | warn | false | 同じ引数を別の関数へ渡すだけの名前付き単一引数arrow function（async版も含む） |
| `no-ternary-statement` | warn | false | `flag ? enable() : disable()` のような文としてのternary |

ruleは意図的に狭く保つ
検証、変換、log、cache、transaction開始などの処理を行うwrapperはpass-through wrapperとして報告しない
準備やassertionのあるtestは空として扱わない

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

### plugins/network

| Rule | 重大度 | Default | 検出対象 |
|------|----------|---------|---------|
| `require-fetch-abort-signal` | warn | false | `signal` optionを省いた `fetch` 呼び出し |
| `require-abort-timeout-cleanup` | warn | false | `setTimeout` callbackで `fetch` をabortしながらそのtimerをclearしない関数 |

### plugins/discord

| Rule | 重大度 | Default | 検出対象 |
|------|----------|---------|---------|
| `no-unsafe-dynamic-discord-message` | warn | false | 明示的な `allowedMentions` policy無しで送る動的なmessage内容 |

## Scoped rules

| Rule | 重大度 | Default | 検出対象 |
|------|----------|---------|---------|
| `no-adapter-import` | error | false | `integrations/` か `adapters/` を含むpathのimport |
| `no-direct-response` | error | false | 対象層での `new Response(...)`、`Response.json(...)`、`Response.redirect(...)` |

対象層を選ぶ `includes` を必要とするため共有presetでは持てない
Project自身の設定で宣言する

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

pluginは `includes` に一致したfileだけで走る
そのためadapter側と、統合層へ到達してよい層では同じimportが有効なままになる
patternはfileのfull pathと照合されるため、`src/modules/authorization` のようなpathへ一致させるには `**/` から始める

pluginの `path` はfile pathとして解決される
そのため上記のように `node_modules` 経由のpathを書く
`@yuu1111/biome-config/plugins/scoped/no-adapter-import.grit` のようなpackage specifierはplugin packageとして解決され、`.grit` fileへは到達しない

統合moduleへ到達してよい層はpatternから外す
自身のadapter実装を `adapters/` に置くmoduleは、そのディレクトリを除外しないとruleがadapter自身を報告する

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

helper module自身はpatternの外に置くため、responseを組み立ててよい
