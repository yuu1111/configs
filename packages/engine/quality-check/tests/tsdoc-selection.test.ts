import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run as runTsdoc } from "@yuu1111/tsdoc-check/run";
import { engineConfig, parseConfig } from "../src/config";

const SOURCE = [
	"export const value = 1",
	"",
	"export function run(input: number): number {",
	"\treturn input",
	"}",
	"",
].join("\n");

/**
 * 一時directoryのfileへconfigを適用して起動したtsdoc-checkのrule名を返す
 *
 * @param rules - tsdoc-checkのsectionへ渡すrulesの値
 * @returns 検出したrule名を位置順に並べた一覧
 */
function rulesWith(rules: Record<string, unknown>): string[] {
	const cwd = mkdtempSync(join(tmpdir(), "quality-tsdoc-"));
	try {
		writeFileSync(join(cwd, "sample.ts"), SOURCE);
		const config = parseConfig(
			{ "tsdoc-check": { enabled: true, rules } },
			"test",
		);
		const section = engineConfig(config, "tsdoc-check");
		if (section === null) {
			throw new Error("tsdoc-check is disabled");
		}
		const report = runTsdoc({
			cwd,
			includes: section.includes,
			options: section.options,
			rules: section.rules,
			targets: ["sample.ts"],
		});
		return [...report.errors, ...report.warnings].map(
			(finding) => finding.rule,
		);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
}

describe("tsdoc-check rule selection", () => {
	test("keeps a doc-scoped rule quiet when the preset turns it off", () => {
		expect(rulesWith({ preset: "none" })).toEqual([]);
	});

	test("keeps a doc-scoped rule quiet when the rule turns it off", () => {
		expect(rulesWith({ documentation: { "missing-doc": "off" } })).toEqual([]);
	});

	test("reports a doc-scoped rule when the rule turns it on", () => {
		expect(rulesWith({ documentation: { "missing-doc": "on" } })).toEqual([
			"missing-doc",
			"missing-doc",
		]);
	});
});
