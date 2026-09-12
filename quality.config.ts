import { defineConfig } from "@yuu1111/quality-check";

export default defineConfig({
	engines: {
		biome: true,
		"comment-check": true,
		"document-style-check": true,
		"tsdoc-check": { args: ["--error", "single-line-doc"] },
	},
});
