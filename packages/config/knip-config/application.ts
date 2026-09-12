import type { KnipConfig } from "knip";
import { base } from "./base";

/**
 * frameworkが動的に読み込むentryは利用Projectが明示するapplication向けのknip設定を提供する
 */
export const application = {
	...base,
	includeEntryExports: false,
} satisfies KnipConfig;
