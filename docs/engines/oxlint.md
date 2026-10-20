# oxlint

利用projectへ導入したOxlintを子プロセスで起動する外部lint engine

## 導入と設定

`oxlint` は利用projectのdevDependenciesへ入れる
`quality-check` は利用projectの `node_modules/.bin` から解決し、Oxlint本体を同梱しない

```bash
bun add -D oxlint
```

```json
{
  "oxlint": true,
  "failOnWarnings": true
}
```

追加の引数は `"oxlint": { "args": ["--config", ".oxlintrc.json"] }` と書ける
ruleの選択と重大度はOxlint固有の設定で指定し、`quality.json` の `rules`、`includes`、`overrides` は受け取らない

## 起動と除外

統合runnerは `oxlint [targets] [args]` を起動する
位置引数の対象pathを渡し、`--ignore` は指定ごとに `--ignore-pattern <ignore>` へ変換する
`failOnWarnings` がtrueなら `--deny-warnings` を追加する

```bash
quality-check oxlint src --ignore src/generated
```

結果はOxlintの終了codeで判定し、統合runnerのbaselineには含めない
engine共通の起動条件は [`quality-check` の設定](../../packages/quality-check/README.ja.md) にある
