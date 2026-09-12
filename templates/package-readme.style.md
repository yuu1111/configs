# package READMEの記法

`templates/package-readme.template.md` を基にpackageのREADMEを書くときの規則

## ファイル

- 正本は `README.md`、日本語版は `README.ja.md` に置く
- 先頭行に相互linkを置く `README.md` は `[日本語](README.ja.md)`、`README.ja.md` は `[English](README.md)`
- 両fileで見出し構成、表の列、code blockのlanguageを一致させる 翻訳で変えるのは説明文と表のcellだけにする

## 見出し

- 見出しは両言語とも英語にする
- 節は `# @yuu1111/<package>` と1文の説明、`## Install`、`## Usage`、参照節、`## Options`、`## Notes` の順に置く
- 参照節は `## Presets`、`## Config`、`## Rules`、`## Commands`、`## Suppressions` の順に置く
- CLIを持つpackageは `## Options` を必ず置く 項目が少なくても省略しない
- `## Notes` は補足があるpackageだけに置く
- 参照節の中を分けるときは `###` を使い、`####` は使わない
- 複数のpresetを持つpackageは `## Presets` に表を置き、presetごとの詳細を `###` で並べる 同じpresetを `## Usage` の `###` と `## Presets` の両方へ重複させない
- 日本語版でも見出しは英語のままにする `## 検査する定義` のような日本語見出しを置かない

## 表

- 列見出しは両言語とも英語にし、列の並びも両言語で同じにする
- 規則の表は `| Rule | Detects |` を基本にし、ruleごとに重大度が変わるpackageだけ `| Rule | Severity | Detects |` にする
- opt-inのruleは `Detects` のcellへ `(opt-in)` と添える
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
