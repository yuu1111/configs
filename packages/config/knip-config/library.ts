import type { KnipConfig } from "knip";
import { base } from "./base";

/**
 * 公開APIのentryを持つlibrary向けのknip設定を提供する
 */
export const library = {
	...base,
	// 公開APIから外れたexportを未使用として報告する
	includeEntryExports: true,
} satisfies KnipConfig;
