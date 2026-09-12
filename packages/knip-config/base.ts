import type { KnipConfig } from "knip";

/**
 * 各knip設定が共通で継承するbase設定を提供する
 */
export const base = {
	// 同一file内で参照しているexportは内部利用とみなす
	ignoreExportsUsedInFile: true,
	// quality-checkが実行時に読み込むため、Projectのsourceとして報告しない
	ignoreFiles: ["quality.config.ts"],
} satisfies KnipConfig;
