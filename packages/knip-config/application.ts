import type { KnipConfig } from "knip";
import { base } from "./base";

// frameworkが動的に読み込むentrypointは利用Projectが明示する
export const application = {
	...base,
	// applicationのentryは公開契約ではないため未使用exportとして報告しない
	includeEntryExports: false,
} satisfies KnipConfig;
