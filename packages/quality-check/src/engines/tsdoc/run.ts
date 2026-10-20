import {
	applyRuleSeverities,
	type FindingEngineContext,
} from "../../shared/engines";
import { collectFiles } from "../../shared/files";
import { toReport } from "../../shared/report";
import { type OptInRuleId, type RuleId, readRuleScopes } from "./rule-ids";
import { scanFiles, TYPESCRIPT_EXTENSIONS } from "./scan";

/**
 * TSDocの構文と公開契約を検査する
 *
 * @param context - 検査する対象とrule選択
 * @returns errorとwarningに分けた検出
 */
export function run(context: FindingEngineContext) {
	const files = collectFiles(context.targets, {
		cwd: context.cwd,
		extensions: TYPESCRIPT_EXTENSIONS,
		includes: context.includes,
	});
	const findings = applyRuleSeverities(
		scanFiles(
			files,
			context.cwd,
			context.rules.enable as OptInRuleId[],
			context.rules.disable as RuleId[],
			readRuleScopes(context.rules.options),
		),
		context.rules,
	);
	return toReport(findings);
}
