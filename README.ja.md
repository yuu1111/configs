[English](README.md)

# configs

npmへ公開する共有設定と検査package

## Packages

| Package | Description |
|---------|-------------|
| [`@yuu1111/biome-config`](packages/config/biome-config/README.ja.md) | 共有の [Biome](https://biomejs.dev/) 設定 |
| [`@yuu1111/knip-config`](packages/config/knip-config/README.ja.md) | 共有の [Knip](https://knip.dev/) 設定 |
| [`@yuu1111/quality-check`](packages/quality-check/README.ja.md) | 検査engineを同梱する統合CLI |
| [`@yuu1111/tsconfig`](packages/config/tsconfig/README.ja.md) | 共有のTypeScript設定 |

共有設定は `packages/config/` にまとめ、統合CLIは `packages/quality-check/` に直接置く
4つの検査engineは `quality-check/src/engines/{code-style,comment,document-style,tsdoc}/` に直接置き、共通処理は `quality-check/src/shared/` に置いて、runtime dependencyを持たない形でbundleする
engineの設定名、CLIのcommand、rule IDは変えない

## Documents

| 文書 | 用途 |
|------|------|
| [構成と設計判断](docs/architecture.md) | packageの層と同梱の理由 |
| [プロジェクトへの導入](docs/adoption.md) | 設定からCIまでの導入手順 |
| [engine の共通規約](docs/engine-contract.md) | 検査engineと統合runnerの間で守る契約 |
| [engine 一覧](docs/engines/index.md) | 外部engineと同梱する検出engineの一覧 |
| [Oxlint](docs/engines/oxlint.md) | 外部lint engineとCLIの連携 |
| [Oxfmt](docs/engines/oxfmt.md) | 読み取り専用のformatチェックと対象fileの選択 |

## Development

Bun workspaceのmonorepo Biomeは自分の共有設定を使い、Oxlintもlintを行う
OxfmtはYAMLだけを担当し、Biomeとformat対象を分ける

```bash
bun install            # install + link workspaces
bun run build          # 検査engineとその依存を @yuu1111/quality-check へ同梱する
bun run lint           # Biome + Oxlint
bun run format:check   # Biome + Oxfmt
bun run format         # Biome + Oxfmtで自動修正
```

## Release

公開はGitHub Releaseの作成時にnpm Trusted Publisher経由で走る
選んだpackageのversionと一致するpackage固有のtagを使う

```bash
cd packages/config/biome-config
bun pm version patch --no-git-tag-version
# Commit and push the version change, then publish biome-config-vX.Y.Z on GitHub.
```

tagは公開するpackageの名前に合わせ、例えば `biome-config-vX.Y.Z` にする
ローカルで `npm publish` は実行しない
