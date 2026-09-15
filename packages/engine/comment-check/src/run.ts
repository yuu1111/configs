import {
	applyRuleSeverities,
	type FindingEngineContext,
} from "@yuu1111/shared/engines";
import { collectFiles } from "@yuu1111/shared/files";
import { toReport } from "@yuu1111/shared/report";
import type { OptInRuleId, RuleId } from "./rule-ids";
import type { Finding } from "./rules";
import { SUPPORTED_EXTENSIONS, scanFiles } from "./scan";

const RULE_MESSAGES: Record<string, string> = {
	"broad-suppression": "file-wide suppression hides too much",
	"cramped-comment": "a multi-line comment needs a blank line before it",
	"japanese-period":
		"a Japanese sentence in a comment does not end with a period",
	"placeholder-comment": "placeholder comment should be resolved or tracked",
	"separator-comment": "decorative separator comment adds no information",
	"undocumented-directive": "TypeScript directive needs a description",
};

/**
 * 検出を報告へ変換する ruleごとの説明をmessageへ載せる
 *
 * @param findings - 報告へ載せる検出
 * @returns severityとmessageを補った報告
 */
function reportOf(findings: readonly Finding[], context: FindingEngineContext) {
	return toReport(
		applyRuleSeverities(
			findings.map((finding) => ({
				column: finding.column,
				file: finding.file,
				line: finding.line,
				message: RULE_MESSAGES[finding.rule] ?? "",
				rule: finding.rule,
				severity: "error" as const,
			})),
			context.rules,
		),
	);
}

/**
 * commentと抑制を検査する
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
	return reportOf(
		scanFiles(
			files,
			context.cwd,
			context.rules.enable as OptInRuleId[],
			context.rules.disable as RuleId[],
		),
		context,
	);
}
