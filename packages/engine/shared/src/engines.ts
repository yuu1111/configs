import type { EngineReport, ReportFinding } from "./report";

/**
 * 統合runnerがengineへ渡すrule選択
 */
export interface RuleSelection {
	/**
	 * 無効にするrule名
	 */
	disable: string[];

	/**
	 * 有効にするopt-in rule名
	 */
	enable: string[];

	/**
	 * 違反へ上げるrule名
	 */
	error: string[];

	/**
	 * warningへ変更するrule名
	 */
	warn: string[];
}

/**
 * rule選択で指定した重大度を検出へ反映する
 *
 * @param findings - 重大度を変更する検出
 * @param rules - ruleごとの選択
 * @returns 指定した重大度を反映した検出
 */
export function applyRuleSeverities(
	findings: readonly ReportFinding[],
	rules: RuleSelection,
): ReportFinding[] {
	return findings.map((finding) => {
		if (rules.error.includes(finding.rule)) {
			return { ...finding, severity: "error" };
		}
		if (rules.warn.includes(finding.rule)) {
			return { ...finding, severity: "warning" };
		}
		return finding;
	});
}

/**
 * in-processで起動するengineへ渡す条件
 */
export interface FindingEngineContext {
	/**
	 * 指摘に載せる相対pathの基準directory
	 */
	cwd: string;

	/**
	 * 検査対象を選ぶglob 否定globは先に選んだ対象を除外する
	 */
	includes: string[];

	/**
	 * engineごとの追加option 検証は統合runnerが持ち engineは既定値へ倒して読む
	 */
	options?: Readonly<Record<string, unknown>>;

	/**
	 * 渡すrule選択
	 */
	rules: RuleSelection;

	/**
	 * 検査する対象path
	 */
	targets: string[];
}

/**
 * in-processで起動するengine 検出のJSONを介さず報告を直接返す
 */
export type FindingEngine = (context: FindingEngineContext) => EngineReport;
