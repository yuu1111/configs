import { library } from "@yuu1111/knip-config/library";

const { entry, ...base } = library;

export default {
	...base,
	workspaces: {
		".": { entry },
	},
	ignoreDependencies: ["@yuu1111/code-style-check"],
};
