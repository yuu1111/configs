import { run as runCodeStyle } from "@yuu1111/code-style-check/run";
import { run as runComment } from "@yuu1111/comment-check/run";
import { run as runDocumentStyle } from "@yuu1111/document-style-check/run";
import type { FindingEngine } from "@yuu1111/shared/engines";
import { run as runTsdoc } from "@yuu1111/tsdoc-check/run";
import type { EngineName, FindingEngineName } from "../config";

/**
 * in-processで起動するengineの実装 並び順ではなくengine名で引く
 */
export const FINDING_ENGINES = {
	"code-style-check": runCodeStyle,
	"comment-check": runComment,
	"document-style-check": runDocumentStyle,
	"tsdoc-check": runTsdoc,
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
