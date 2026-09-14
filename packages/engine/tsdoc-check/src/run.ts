import type { FindingEngineContext } from "@yuu1111/shared/engines";
import { collectFiles } from "@yuu1111/shared/files";
import { toReport } from "@yuu1111/shared/report";
import {
	DEFAULT_DOC_SCOPE,
	DOC_SCOPES,
	type DocScope,
	type OptInRuleId,
	type RuleId,
} from "./rule-ids";
import { promoteFindings } from "./rules";
import { scanFiles, TYPESCRIPT_EXTENSIONS } from "./scan";

/**
 * 統合runnerが渡した値をdocScopeとして読む 不正な値は既定値へ倒す
 *
 * @param value - engineのoptionとして渡された値
 * @returns 読み取ったdocScope
 */
function readDocScope(value: unknown): DocScope {
	return typeof value === "string" &&
		(DOC_SCOPES as readonly string[]).includes(value)
		? (value as DocScope)
		: DEFAULT_DOC_SCOPE;
}

/**
 * TSDocの構文と公開契約を検査する
 *
 * @param context - 検査する対象とrule選択とoption
 * @returns errorとwarningに分けた検出
 */
export function run(context: FindingEngineContext) {
	const files = collectFiles(context.targets, {
		cwd: context.cwd,
		extensions: TYPESCRIPT_EXTENSIONS,
		ignores: context.ignores,
	});
	const findings = promoteFindings(
		scanFiles(
			files,
			context.cwd,
			context.rules.enable as OptInRuleId[],
			context.rules.disable as RuleId[],
			readDocScope(context.options?.docScope),
		),
		context.rules.error,
	);
	return toReport(findings);
}
