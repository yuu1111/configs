import type { FindingEngineContext } from "@yuu1111/shared/engines";
import { collectFiles } from "@yuu1111/shared/files";
import { toReport } from "@yuu1111/shared/report";
import type { OptInRuleId, RuleId } from "./rule-ids";
import { DOCUMENT_EXTENSIONS, lintFiles } from "./scan";

/**
 * Markdownの機械的な違反を検査する
 *
 * @param context - 検査する対象とrule選択
 * @returns errorとwarningに分けた検出
 */
export function run(context: FindingEngineContext) {
	const files = collectFiles(context.targets, {
		cwd: context.cwd,
		extensions: DOCUMENT_EXTENSIONS,
		ignores: context.ignores,
	});
	return toReport(
		lintFiles(
			files,
			context.cwd,
			context.rules.enable as OptInRuleId[],
			context.rules.disable as RuleId[],
		),
	);
}
