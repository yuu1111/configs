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
		"comment-check": {
			enable: ["cramped-comment", "japanese-period"],
		},
		"document-style-check": {
			enable: ["japanese-period"],
		},
		"tsdoc-check": {
			enable: ["deprecated-without-guidance", "missing-returns", "param-order"],
			error: [
				"deprecated-without-guidance",
				"missing-doc",
				"missing-returns",
				"param-order",
				"param-untagged",
				"single-line-doc",
				"tsdoc-tag",
				"type-param-untagged",
			],
		},
	},
});
