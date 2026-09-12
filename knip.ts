import { library } from "@yuu1111/knip-config/library";

export default {
	...library,
	// 利用Projectの quality.config.ts からimportするため、このrepository内では未使用に見える
	ignoreIssues: { "packages/quality-check/src/config.ts": ["exports"] },
};
