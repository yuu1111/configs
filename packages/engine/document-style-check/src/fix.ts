import type { FindingEngineContext } from "@yuu1111/shared/engines";
import { collectFiles } from "@yuu1111/shared/files";
import type { OptInRuleId, RuleId } from "./rule-ids";
import { DOCUMENT_EXTENSIONS, fixFiles } from "./scan";

/**
 * Markdownを整形し 変更したfileを返す
 *
 * @param context - 整形する対象とrule選択
 * @returns 実際にwriteしたfileの絶対path
 */
export function fix(context: FindingEngineContext): string[] {
	const files = collectFiles(context.targets, {
		cwd: context.cwd,
		extensions: DOCUMENT_EXTENSIONS,
		includes: context.includes,
	});
	return fixFiles(
		files,
		context.rules.enable as OptInRuleId[],
		context.rules.disable as RuleId[],
	);
}
