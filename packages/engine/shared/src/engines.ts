import type { EngineReport } from "./report";

/**
 * 統合runnerがengineへ渡すrule選択
 */
export interface RuleSelection {
	/** 無効にするrule名 */
	disable: string[];
	/** 有効にするopt-in rule名 */
	enable: string[];
	/** 違反へ上げるrule名 */
	error: string[];
}

/**
 * in-processで起動するengineへ渡す条件
 */
export interface FindingEngineContext {
	/** 指摘に載せる相対pathの基準directory */
	cwd: string;
	/** 検査から外すpath */
	ignores: string[];
	/** 渡すrule選択 */
	rules: RuleSelection;
	/** 検査する対象path */
	targets: string[];
}

/**
 * in-processで起動するengine 検出のJSONを介さず報告を直接返す
 */
export type FindingEngine = (context: FindingEngineContext) => EngineReport;
