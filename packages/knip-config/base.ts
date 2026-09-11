import type { KnipConfig } from "knip";

export const base = {
	// 同一file内で参照しているexportは内部利用とみなす
	ignoreExportsUsedInFile: true,
} satisfies KnipConfig;
