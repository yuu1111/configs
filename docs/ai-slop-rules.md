# AI slop対策として各Projectが採用するルール

AIコーディングエージェントが残す定型的な低品質コード(slop)を防ぐため、公開されているlint plugin、検出CLI、エージェント向けルール集が採用しているルールを整理する
個々のProjectの全ルールではなく、slopの検出に特徴的なものと、複数のProjectで一致しているものを対象にする

## Projectごとのルールセット

### anti-slop

[dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) はOxlint向けのTypeScriptとJavaScriptのルール集で、根拠の薄い型操作と余分な間接参照を拒否する
npm packageにせずvendorして自projectの基準へ変えることを前提にしている

- `no-chained-type-assertions` — `as object as User` のようなネストしたassertionを拒否する
- `no-widen-then-assert` — 既知の値を `unknown` や広い型へ広げてから狭め直す流れを拒否する
- `no-unknown-parameters` / `no-unknown-returns` / `no-unknown-type-aliases` — 関数の契約に `unknown` が現れることを拒否する
- `no-object-parameters` — 引数の `object` 型を拒否する
- `no-unsafe-dictionary-type` — `unknown` や `any` を値に持つ辞書型を拒否する
- `no-reflect-get` / `no-reflect-apply` — 型の付かない `Reflect` 呼び出しを拒否する
- `no-runtime-typeof` — 境界のparseではなく場当たり的な `typeof` 絞り込みを拒否する
- `no-conditional-empty-object-spread` — 条件付きの空object spreadでfieldを省略する書き方を拒否する
- `no-array-filter-map` / `no-reduce-accumulator-copy` — 配列の二度走査とaccumulatorのコピーを拒否する
- `require-readable-spacing` — 宣言間や制御構文前の空行を要求する
- `require-safety-comment-for-type-assertion` — `as const` 以外のassertionに根拠コメントを要求する
- `no-module-mocking` — モジュールmockではなく依存の継ぎ目を要求する

### aislop

[scanaislop/aislop](https://github.com/scanaislop/aislop) は50以上のルールを8言語以上へ適用するCLIで、slop固有のルールを1つの節にまとめている

- `trivial-comment` — コードを言い換えるだけのコメント
- `narrative-comment` — 区切りコメント、phaseやsectionの見出し、意味の無いpreamble
- `meta-comment` — 実装phaseやエージェントの動作についてのコメント
- `swallowed-exception` — 空のcatchと、logだけのcatch
- `silent-recovery` — 原因を出さずにlogだけして処理を続けるcatch
- `hidden-fallback` — 失敗や欠損を安全そうな値へ置き換えるfallback
- `redundant-try-catch` — 同じerrorを投げ直すだけのcatch
- `redundant-type-coercion` — 型付き引数への `String()` や `Number()` や `Boolean()` の再変換
- `duplicate-type-declaration` — 同名同形の型宣言の重複
- `thin-wrapper` — 引数をそのまま転送するだけの関数
- `generic-naming` — `helper_1` `data2` `temp1` のような名前
- `console-leftover` — 本番コードに残った `console.log`
- `todo-stub` — issueに紐づかないTODO
- `unsafe-type-assertion` / `double-type-assertion` — `as any` と `as unknown as X`
- `hallucinated-import` — manifestに無いpackageのimport
- `tautological-test` — 同じリテラル同士の比較
- `hardcoded-url` / `hardcoded-id` — 環境依存のURLやIDの直書き
- `unreachable-code` / `constant-condition` / `empty-function`
- `complexity/*` — 関数長、file長、nesting、引数数のしきい値
- `code-quality/duplicate-block` — 重複した実装block

### eslint-plugin-deslop

[eslint-plugin-deslop](https://www.npmjs.com/package/eslint-plugin-deslop) はコメントだけに絞ったpluginで、`no-obvious-comments` を提供する
関数本体のコードを言い換えるコメントを検出して `--fix` で削除し、JSDocやTSDocや意図を補うコメントは対象外にする

### deslopとdeslopper

[dabit3/deslop](https://github.com/dabit3/deslop) と [deslopper](https://www.npmjs.com/package/deslopper) はdiffを対象にした検出器で、正規表現で定型patternを拾い、任意でモデルが文脈判断を足す

- デバッグ用の `console.log` と関数の入口・出口ログ
- 文脈の無いTODO placeholder
- nullとundefinedの三重チェックのような過剰な防御
- logだけの空catch
- 「Initialize the variable」のような明白なコメント
- section dividerコメント
- 冗長な `return undefined`
- `=== true` のような明示的なboolean比較
- 不要なtry-catch wrapper
- 単一promiseへの `Promise.all`

### eslint-plugin-ai-code-snifftest

[eslint-plugin-ai-code-snifftest](https://github.com/mojoatomic/eslint-plugin-ai-code-snifftest) は8ルールと、file長と複雑度のしきい値を組み合わせる

- `no-generic-names` / `enforce-domain-terms` — 汎用名を避け、project固有の語彙を要求する
- `no-unnecessary-abstraction` — 単一用途の薄いwrapperをinlineさせる
- `no-equivalent-branches` — 同じ処理をするif/elseを検出する
- `no-redundant-conditionals` / `prefer-simpler-logic` / `no-redundant-calculations`
- 複雑度の上限 — `max-lines` 250行、`max-lines-per-function` 50行、`complexity` 10、`max-depth` 4、`max-params` 4、`max-statements` 30
- 増加を防ぐratchet — 既存の指摘数をbaselineにして増加だけを失敗にする

### markdown-discipline

[HermeticOrmus/markdown-discipline-skills](https://github.com/HermeticOrmus/markdown-discipline-skills) はMarkdownと文書のAI tellを対象にする

- emojiをheading、bullet、区切りに使わない
- `robust` `powerful` `seamless` `leverage` のような形容詞と動詞を削る
- headingはsentence caseにし、1 fileに1つのH1にする
- bulletは1文1項目、nestingは2段までにする
- code fenceには必ず言語を書く
- link textを説明的にし、相対pathを使う
- 表は3項目×2次元以上の比較に限る
- em dashを乱用しない
- triple-cataloging、antithesis、clipped fragments、soft closeを使わない

### その他の採用例

- [miqdadbadjuber/anti-slop](https://github.com/miqdadbadjuber/anti-slop) はUIとコピーの38ルールをHard GateとPurpose-Gateの2段に分け、理由の無い技法を拒否する
- [peakoss/anti-slop](https://github.com/peakoss/anti-slop) はPR単位の34チェックで、branch、size、title、description、commit messageを対象にする
- [Archlintのbarrel file検出](https://archlinter.github.io/archlint/ja/detectors/barrel_file.html) は再exportの乱用を対象にする

## 複数のProjectで一致するルール

### コメント

明白なコメント、区切りコメント、phaseやsectionのnarration、意味の無いpreambleを削る
TODOは追跡先を要求し、抑制には理由を要求する

### 例外と失敗

空のcatch、logだけのcatch、原因を捨てる再throw、失敗を安全そうな値へ置き換えるfallbackを拒否する
silent recoveryとhidden fallbackは別のルールとして扱う例が多い

### 型安全

`as any`、`as unknown as X`、広げてから狭めるassertion、`unknown` や `object` の引数と戻り値、場当たり的な `typeof` を拒否する
assertionには根拠コメントを要求する例がある

### 過剰な防御

nullの三重チェック、起こり得ない分岐への対応、不要なtry-catch wrapperを拒否する

### 抽象と重複

引数をそのまま転送するwrapper、単一用途の薄い抽象、重複したblockや型宣言を拒否する
Barrel fileと再exportも同じ分類に入る

### 残骸

デバッグ出力、unreachable code、空関数、placeholderのthrow、未使用importを検出する

### 命名

`data2` や `temp1` のような機械的な名前を避け、project固有の語彙を要求する

### 複雑度

関数長、file長、nesting、引数数、statement数にしきい値を置く
複雑度の上限は新規の増加だけを失敗させるratchetと組み合わせる例がある

### テスト

自己比較や固定リテラル同士の比較のような、失敗し得ないassertionを拒否する
モジュールmockより依存の継ぎ目を要求する例もある

### 文書

Markdownでも、code fenceの言語指定、見出し構成、marketing表現、emoji、em dashを対象にする

## このrepoの検査との関係

既存の検査でslopの主要部分を捕まえられるものがある

- `biome-config` の `no-incomplete-implementation` — 空catchとlogだけのcatch
- `biome-config` の `no-type-safety-bypass` — `as unknown as` と辞書assertion
- `biome-config` の `no-useless-abstraction` — 転送wrapper
- `biome-config` の `no-meaningless-test` — 自己比較と空test
- `code-style-check` — 隣接する定義の間の空行漏れ（anti-slopの `require-readable-spacing` に相当）
- `comment-check` — placeholder、separator、directiveの記述漏れ

未対応のものは次の通り

- 明白なコメントの検出
- hidden fallbackとsilent recovery
- redundant try-catch
- duplicate type declaration
- generic naming
- hallucinated import
- hardcoded URLやID
- unreachable code
- 複雑度のしきい値
- Markdownのfence言語と見出し構成

候補との重なりは `docs/rule-candidates.md` で扱う
