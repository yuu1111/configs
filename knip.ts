import { library } from "@yuu1111/knip-config/library";

export default {
	...library,
	// 消費Projectの quality.config.ts からimportするため、このrepo内では未使用に見える
	ignoreIssues: { "packages/quality-check/src/config.ts": ["exports"] },
};
