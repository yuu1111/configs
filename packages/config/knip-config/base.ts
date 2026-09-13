import type { KnipConfig } from "knip";

/**
 * 各presetが共通で継承するbase設定を提供する
 */
export const base = {
	entry: ["quality.json"],
	ignoreExportsUsedInFile: true,
} satisfies KnipConfig;
