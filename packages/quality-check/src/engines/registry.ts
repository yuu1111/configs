import type { EngineName, FindingEngineName } from "./catalog";
import { run as runCode } from "./code/run";
import { run as runComment } from "./comment/run";
import type { FindingEngine } from "./contract";
import { run as runMarkdown } from "./markdown/run";
import { run as runTsdoc } from "./tsdoc/run";

/**
 * in-processで起動するengineの実装 並び順ではなくengine名で引く
 */
export const FINDING_ENGINES = {
	code: runCode,
	comment: runComment,
	markdown: runMarkdown,
	tsdoc: runTsdoc,
} satisfies Record<FindingEngineName, FindingEngine>;

/**
 * テストで差し替えられるengine実装の組
 */
export type FindingEngineRegistry = Record<FindingEngineName, FindingEngine>;

/**
 * 検出engineか 検出engineは統合CLIがin-processで呼ぶ
 *
 * @param name - 判定するengine名
 * @returns 検出engineならtrue
 */
export function isFindingEngine(name: EngineName): name is FindingEngineName {
	return name in FINDING_ENGINES;
}
