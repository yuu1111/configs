import {
	applyRuleSeverities,
	type FindingEngineContext,
} from "@yuu1111/shared/engines";
import { collectFiles } from "@yuu1111/shared/files";
import { type EngineReport, toReport } from "@yuu1111/shared/report";
import type { OptInRuleId, RuleId } from "./rule-ids";
import { DOCUMENT_EXTENSIONS, lintFiles } from "./scan";

/**
 * 検査したMarkdownと報告
 */
export interface DocumentInspection {
	/**
	 * 検査したMarkdownの絶対path
	 */
	files: string[];
	report: EngineReport;
}

/**
 * Markdownを集めて機械的な違反を検査する
 *
 * @param context - 検査する対象とrule選択
 * @returns 検査したfileとerrorとwarningに分けた検出
 */
export function inspect(context: FindingEngineContext): DocumentInspection {
	const files = collectFiles(context.targets, {
		cwd: context.cwd,
		extensions: DOCUMENT_EXTENSIONS,
		includes: context.includes,
	});
	return {
		files,
		report: toReport(
			applyRuleSeverities(
				lintFiles(
					files,
					context.cwd,
					context.rules.enable as OptInRuleId[],
					context.rules.disable as RuleId[],
				),
				context.rules,
			),
		),
	};
}

/**
 * Markdownの機械的な違反を検査する
 *
 * @param context - 検査する対象とrule選択
 * @returns errorとwarningに分けた検出
 */
export function run(context: FindingEngineContext): EngineReport {
	return inspect(context).report;
}
