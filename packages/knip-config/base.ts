import type { KnipConfig } from "knip";

/**
 * 各presetが共通で継承するbase設定を提供する
 */
export const base = {
	// quality-checkが実行時に読み込むentrypointとして扱い、未使用fileとして報告しない
	entry: ["quality.config.ts"],
	// 同一file内で参照しているexportは内部利用とみなす
	ignoreExportsUsedInFile: true,
	// config file自身のexportは利用側の入口ではないため報告しない
	ignoreIssues: { "quality.config.ts": ["exports"] },
} satisfies KnipConfig;
