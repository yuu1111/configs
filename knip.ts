import { library } from "@yuu1111/knip-config/library";

export default {
	...library,
	// quality-checkが実行時にnode_modules/.binから解決する
	ignoreDependencies: [
		"@yuu1111/code-style-check",
		"@yuu1111/comment-check",
		"@yuu1111/document-style-check",
		"@yuu1111/tsdoc-check",
	],
};
