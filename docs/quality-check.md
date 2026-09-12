# quality-checkの設計

## 目的

Projectごとに散っていた品質検査の起動を1つのCLIへ集め、どのengineが失敗したかを1回の実行で示す

engineの設定はengine自身が持ち、quality-checkは起動と結果の集約だけを行う この境界を保つとengineが増えてもquality-checkの設定語彙は増えない

## 起動条件の置き場所

| セクション | 意味 |
|---|---|
| `engines` | 起動するengineの委任 値は `true` または `false` |
| `config` | engineごとの起動条件 |
| `baseline` | 集約するbaselineの差分判定 |

`engines` は何を動かすかだけを表し、どう動かすかは `config` へ置く 同じengineの話を1か所へ集めると、設定の混ざりはengineの境界ではなくセクションで解ける

engineは登録順に起動する 設定のkey順には依存しない

## 受け取れない条件の扱い

engineが受け取れる条件はengineのCLIが決める 型で禁止せず、受け取れない条件を書いた場合は渡さずに理由をそのengineのsectionへ出す

```text
== biome ==
biome: ignore skipped (biome.json holds its settings)
```

自分の設定fileを持つengineは `config` に出てこない 除外pathの持ち主がengine自身だからである

## 型検査の理想

`typecheck` は `tsc --noEmit` を回す 型検査の設定は `tsconfig.json` が持つため、いまは `args` 以外の起動条件を持たない

理想は、`tsconfig.json` を複数持つProjectでも1つのengineで全部を検査することである 実装する前は2本目を `&&` で繋ぐか `check:quality` の script へ足していた

### projects で複数のtsconfigを回す

`config.typecheck.projects` に `tsc -p` が解釈できるpathを並べ、pathごとに `tsc --noEmit -p <path>` を起動する

- `projects` を省略したときは `tsc --noEmit` を1回だけ起動する このときはカレントの `tsconfig.json` を使う
- `projects` のpathは `tsconfig.json` を指すfileと、それを含むディレクトリの両方を受ける
- `ignore` と `targets` は受け取らない 型検査の対象は `tsconfig.json` の `include` と `exclude` が決める
- 起動ごとの出力をすべて残し、sectionの終了codeは最も重いものへ寄せる 1本でも型errorを出せば `failed` になる
- `args` はすべての起動へ同じものを足す

```ts
export default defineConfig({
	engines: { typecheck: true },
	config: { typecheck: { projects: [".", "examples/client"] } },
});
```

### 保留していた理由

- engineごとの起動条件が増えるほど、quality-checkがengineの設定を写すことになる
- 複数起動を一般化すると、`args` を各起動へ配る規則や、失敗した起動だけを報告する規則も決める必要がある
- 実装を決めた時点では、複数のtsconfigを持つProjectが1つだけだった

### 実装する条件

同じ形の複数起動が3 Project以上にあること その条件は既に満たしている

| 形 | いまの起動 |
|---|---|
| 本体と、入れ子の別Project | `tsc --noEmit && tsc --noEmit -p examples/client/tsconfig.json` |
| 本体と、test用のtsconfig | `tsc --noEmit && tsc -p tsconfig.test.json` |
| 本体と、別の実行環境向けのtsconfig | `tsc --noEmit && tsc --noEmit -p tsconfig.client.json` |

2本目の `noEmit` は2本目の `tsconfig.json` 側が持つ場合もあり、どちらも `tsc --noEmit -p <path>` へ置き換わる

`tsc -b` で複数のtsconfigを1回で読むProjectは `projects` を必要としない

## engineが自分の設定を持つようになったら

理想は、quality-checkがengineの起動条件を持たないことである engineのCLIが自分の設定fileを読めば、`config` のengineごとのentryは要らなくなる

たとえば `comment-check` が `comment.config.ts` を持てば `config.comment-check.ignore` はquality-checkから消える そのためにはengine側が設定fileの解決順と、対象pathの既定値を持つ必要がある

## いまの実装との差

| 理想 | いまの実装 |
|---|---|
| engineが設定fileの解決順を持つ | quality-checkがengineごとの起動条件を組み立てる |
| engineの追加がengine側だけで済む | `ENGINE_NAMES` と受け取り能力の表をquality-checkへ足す |
