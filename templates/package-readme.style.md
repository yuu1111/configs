# package READMEの記法

`templates/package-readme.template.md` を基にpackageのREADMEを書くときの規則

## ファイル

- 正本は `README.md`、日本語版は `README.ja.md` に置く
- 先頭行に相互linkを置く `README.md` は `[日本語](README.ja.md)`、`README.ja.md` は `[English](README.md)`
- 両fileで見出し構成、表の列、code blockのlanguageを一致させる 翻訳で変えるのは説明文と表のcellだけにする

## 見出し

- 節見出しは短い技術名（`Install`、`Usage`、`Rules`、`Options`、`Notes` など）を両言語で共通に使う 日本語版で説明的な見出しを足す場合は日本語にする 例: `## 他のlinterとの対応`
- 節は `# @yuu1111/<package>` と1文の説明、`## Install`、`## Usage`、参照節、`## Options` の順に置く
- 参照節は `## Presets`、`## Config`、`## Rules`、`## Commands`、`## Suppressions` の順に置く
- 参照節に当てはまらない説明的な節は参照節の後ろ、`## Options` の前へ置く
- CLIを持つpackageは `## Options` を必ず置く 項目が少なくても省略しない
- 補足は `## Notes` へまとめず、該当する節へ書く 末尾のcatch-allの節を置かない
- 参照節の中を分けるときは `###` を使い、`####` は使わない
- 複数のpresetを持つpackageは `## Presets` に表を置き、presetごとの詳細を `###` で並べる 同じpresetを `## Usage` の `###` と `## Presets` の両方へ重複させない

## 表

- 列見出しは技術名を英語、説明列を日本語版で日本語にする 列の並びは両言語で同じにする 例: `| Option | 説明 |`、`| Preset | 用途 |`
- 規則の表は `| Rule | Severity | Default | Detects |`（日本語版は `| Rule | 重大度 | Default | 検出対象 |`）にし、4列をどのpackageでも省略しない
- 他packageへ同梱する private な engine は README を持たず、設定とruleの正本を `docs/engines/<engine>.md` に置く
- `docs/engines/` の表は `| Rule | Group | 重大度 | Default | 検出対象 |` にし、列をどのengineでも省略しない
- `Severity` は `error` と `warning`、`Default` は `true` と `false` で示す opt-in ruleだけ `Default` を `false` にする
- 表と箇条書きの末尾に句点を付けない

## コードブロック

- languageは `bash`、`json`、`ts`、`text` だけを使う
- 実行例は `bash`、その出力は `text` にし、languageの無いblockを置かない
- commandは実行file名をそのまま書き、`bunx` を付けない
- code例のindentはJSONを2 space、TypeScriptをtabにする

## 本文

- 説明はpackageが何をするかの1文から始める
- 段落は文の終わりか意味の切れ目で改行し、固定幅で折り返さない
- 箇条書きは1項目1文にまとめ、長い場合は意味の切れ目で改行する
- 日本語版に句点 `。` を置かない 区切りが要る場合は読点や接続でつなぐ
