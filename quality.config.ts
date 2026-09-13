import * as commentCheck from "@yuu1111/comment-check/rule-ids";
import * as documentStyleCheck from "@yuu1111/document-style-check/rule-ids";
import { defineConfig } from "@yuu1111/quality-check";
import * as tsdocCheck from "@yuu1111/tsdoc-check/rule-ids";

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
		"comment-check": { enable: [...commentCheck.OPT_IN_RULE_IDS] },
		"document-style-check": { enable: [...documentStyleCheck.OPT_IN_RULE_IDS] },
		"tsdoc-check": {
			enable: [...tsdocCheck.OPT_IN_RULE_IDS],
			error: [...tsdocCheck.KNOWN_RULE_NAMES],
		},
	},
});
