import {
	applyRuleSeverities,
	type FindingEngineContext,
} from "@yuu1111/shared/engines";
import { collectFiles } from "@yuu1111/shared/files";
import { toReport } from "@yuu1111/shared/report";
import type { RuleId } from "./rule-ids";
import { SUPPORTED_EXTENSIONS, scanFiles } from "./scan";

/**
 * 定義の間隔を検査する
 *
 * @param context - 検査する対象とrule選択
 * @returns errorとwarningに分けた検出
 */
export function run(context: FindingEngineContext) {
	const files = collectFiles(context.targets, {
		cwd: context.cwd,
		extensions: SUPPORTED_EXTENSIONS,
		includes: context.includes,
	});
	return toReport(
		applyRuleSeverities(
			scanFiles(files, context.cwd, context.rules.disable as RuleId[]),
			context.rules,
		),
	);
}
