import { defineConfig } from "@yuu1111/quality-check";

export default defineConfig({
	engines: {
		biome: true,
		typecheck: true,
		knip: true,
		"code-style-check": true,
		"comment-check": true,
		"document-style-check": true,
		"tsdoc-check": true,
	},
	config: {
		// rule名をkeyにしてoff / on / errorを渡す 既定で有効なruleへはoffを渡せない
		"comment-check": {
			rules: {
				"cramped-comment": "on",
				"japanese-period": "on",
			},
		},
		// ruleをまとめて選ぶときはpresetを使う
		"document-style-check": { enable: true },
		// 全ruleを違反として扱い opt-inのruleは先に有効にする
		"tsdoc-check": { error: true },
	},
});
