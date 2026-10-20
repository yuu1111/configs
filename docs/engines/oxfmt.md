# oxfmt

利用projectへ導入したOxfmtを子プロセスで起動する外部format engine

## 導入と設定

`oxfmt` は利用projectのdevDependenciesへ入れる
`quality-check` は利用projectの `node_modules/.bin` から解決し、Oxfmt本体を同梱しない

```bash
bun add -D oxfmt
```

```json
{
  "oxfmt": true
}
```

追加の引数は `"oxfmt": { "args": ["--config", ".oxfmtrc.json"] }` と書ける
formatの設定はOxfmt固有の設定で指定し、`quality.json` の `rules`、`includes`、`overrides` は受け取らない

## 起動と除外

統合runnerは `oxfmt --check [targets] [args]` を起動する
位置引数の対象pathを渡し、既定ではfileを書き換えずformatを検査する

```bash
quality-check oxfmt .
```

統合CLIの `--ignore` は受け取らず、engineのsectionへskipを表示する
除外は `.oxfmtrc.json` の `ignorePatterns` とignore fileで指定する
結果はOxfmtの終了codeで判定し、統合runnerのbaselineには含めない

## Biomeとの分担

BiomeとOxfmtを併用するときは、同じfileを両方でformatしないよう対象を分ける
このrepoでは `.oxfmtrc.json` の次の設定でYAMLだけをOxfmtへ渡す

```json
{
  "ignorePatterns": ["*", "!*/", "!*.yaml", "!*.yml"]
}
```

`*` で一度除外し、directoryを辿れるように戻したうえで `.yaml` と `.yml` だけを対象へ戻す
`bun run format:check` は検査し、`bun run format` は `oxfmt --write .` でYAMLを整形する
engine共通の起動条件は [`quality-check` の設定](../../packages/quality-check/README.ja.md) にある
