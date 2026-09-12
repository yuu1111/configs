import type { KnipConfig } from "knip";
import { base } from "./base";

// 公開APIのentryから未使用になったexportを報告する
/**
 * 公開APIのentryを持つlibrary向けのknip設定を提供する
 */
export const library = {
	...base,
	includeEntryExports: true,
} satisfies KnipConfig;
