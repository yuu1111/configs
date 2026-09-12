import { library } from "@yuu1111/knip-config/library";

const { entry, ...base } = library;

export default {
	...base,
	workspaces: {
		".": { entry },
	},
	ignoreDependencies: [
		"@yuu1111/code-style-check",
		"@yuu1111/comment-check",
		"@yuu1111/document-style-check",
		"@yuu1111/tsdoc-check",
	],
};
