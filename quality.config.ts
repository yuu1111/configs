import { OPT_IN_RULE_IDS as COMMENT_CHECK_OPT_IN_RULES } from "@yuu1111/comment-check/rule-ids";
import { OPT_IN_RULE_IDS as DOCUMENT_STYLE_CHECK_OPT_IN_RULES } from "@yuu1111/document-style-check/rule-ids";
import { defineConfig } from "@yuu1111/quality-check";
import {
	OPT_IN_RULE_IDS as TSDOC_CHECK_OPT_IN_RULES,
	KNOWN_RULE_NAMES as TSDOC_CHECK_RULE_NAMES,
} from "@yuu1111/tsdoc-check/rule-ids";

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
			enable: [...COMMENT_CHECK_OPT_IN_RULES],
		},
		"document-style-check": {
			enable: [...DOCUMENT_STYLE_CHECK_OPT_IN_RULES],
		},
		"tsdoc-check": {
			enable: [...TSDOC_CHECK_OPT_IN_RULES],
			error: [...TSDOC_CHECK_RULE_NAMES],
		},
	},
});
