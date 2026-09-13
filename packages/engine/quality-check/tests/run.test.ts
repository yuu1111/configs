import { describe, expect, test } from "bun:test";
import { createBaseline } from "@yuu1111/shared/baseline";
import { parseConfig } from "../src/config";
import type { EngineProcessResult, EngineRunner } from "../src/engines";
import type { NormalizedFinding } from "../src/findings";
import { type RunOptions, runEngines } from "../src/run";

const documentFinding: NormalizedFinding = {
	column: 12,
	engine: "document-style-check",
	file: "README.md",
	line: 18,
	rule: "hard-break-html",
	severity: "error",
	text: "an HTML hard break adds spacing without meaning",
};

const commentFinding: NormalizedFinding = {
	column: 3,
	engine: "comment-check",
	file: "src/a.ts",
	line: 2,
	rule: "placeholder-comment",
	severity: "error",
	text: "TODO: one",
};

const periodFinding: NormalizedFinding = {
	column: 5,
	engine: "comment-check",
	file: "src/a.ts",
	line: 1,
	rule: "japanese-period",
	severity: "error",
	text: "説明。",
};

/**
 * engineの`--json`出力を組み立てる
 *
 * @param errors - errorとして返す検出
 * @param warnings - warningとして返す検出
 * @returns 検出のtextをmessageへ詰め替えたJSON text
 */
function reportOutput(
	errors: NormalizedFinding[],
	warnings: NormalizedFinding[] = [],
): string {
	const toFinding = (finding: NormalizedFinding) => ({
		column: finding.column,
		file: finding.file,
		line: finding.line,
		message: finding.text,
		rule: finding.rule,
	});
	return JSON.stringify({
		errors: errors.map(toFinding),
		warnings: warnings.map(toFinding),
	});
}

/**
 * warning1件だけを返すengineの出力を組み立てる
 *
 * @param finding - warningとして返す検出
 * @returns warningだけを持つJSON text
 */
function warningOutput(finding: NormalizedFinding): string {
	return reportOutput([], [finding]);
}

function runnerFor(result: EngineProcessResult): EngineRunner {
	return async () => result;
}

function createOptions(overrides: Partial<RunOptions>): RunOptions {
	return {
		baseline: null,
		color: false,
		config: parseConfig({ biome: { enabled: true } }, "test"),
		cwd: ".",
		overrides: { ignore: [], targets: ["."] },
		resolve: () => "/fake/bin",
		...overrides,
	};
}

describe("engine orchestration", () => {
	test("passes the color capability to the engine command", async () => {
		const commands: string[][] = [];
		await runEngines(
			createOptions({
				color: true,
				runner: async (command) => {
					commands.push(command);
					return { exitCode: 0, stderr: "", stdout: "" };
				},
			}),
		);
		expect(commands[0]).toContain("--colors=force");
	});

	test("passes a process engine that exits with 0", async () => {
		const results = await runEngines(
			createOptions({
				runner: runnerFor({ exitCode: 0, stderr: "", stdout: "clean" }),
			}),
		);
		expect(results[0]?.status).toBe("passed");
		expect(results[0]?.output).toBe("clean");
	});

	test("times an engine that ran", async () => {
		const results = await runEngines(
			createOptions({
				runner: runnerFor({ exitCode: 0, stderr: "", stdout: "" }),
			}),
		);
		expect(results[0]?.durationMs).toBeGreaterThanOrEqual(0);
	});

	test("fails a process engine that exits with 1", async () => {
		const results = await runEngines(
			createOptions({
				runner: runnerFor({ exitCode: 1, stderr: "found issues", stdout: "" }),
			}),
		);
		expect(results[0]?.status).toBe("failed");
		expect(results[0]?.output).toBe("found issues");
	});

	test("marks a process engine that exits with 2 as an error", async () => {
		const results = await runEngines(
			createOptions({
				runner: runnerFor({ exitCode: 2, stderr: "", stdout: "" }),
			}),
		);
		expect(results[0]?.status).toBe("error");
		expect(results[0]?.message).toBe("biome could not finish");
	});

	test("runs the type checker once per project and keeps every output", async () => {
		const commands: string[][] = [];
		const results = await runEngines(
			createOptions({
				config: parseConfig(
					{
						typecheck: { enabled: true, projects: [".", "examples/client"] },
					},
					"test",
				),
				runner: async (command) => {
					commands.push(command);
					return {
						exitCode: command.includes("examples/client") ? 1 : 0,
						stderr: "",
						stdout: "checked",
					};
				},
			}),
		);
		expect(commands).toHaveLength(2);
		expect(results[0]?.exitCode).toBe(1);
		expect(results[0]?.status).toBe("failed");
		expect(results[0]?.output).toBe(
			[
				"$ /fake/bin --noEmit --project .",
				"checked",
				"",
				"$ /fake/bin --noEmit --project examples/client",
				"checked",
			].join("\n"),
		);
	});

	test("keeps a single project output free of a command header", async () => {
		const results = await runEngines(
			createOptions({
				config: parseConfig(
					{
						typecheck: { enabled: true, projects: ["."] },
					},
					"test",
				),
				runner: runnerFor({ exitCode: 0, stderr: "", stdout: "checked" }),
			}),
		);
		expect(results[0]?.output).toBe("checked");
	});

	test("reports an engine that is not installed", async () => {
		const results = await runEngines(createOptions({ resolve: () => null }));
		expect(results[0]?.status).toBe("error");
		expect(results[0]?.message).toBe("biome is not installed");
		expect(results[0]?.durationMs).toBeNull();
	});
	test("reports a condition that the engine could not take", async () => {
		const results = await runEngines(
			createOptions({
				config: parseConfig({ biome: { enabled: true } }, "test"),
				overrides: { ignore: ["dist"], targets: [] },
				runner: runnerFor({ exitCode: 0, stderr: "", stdout: "" }),
			}),
		);
		expect(results[0]?.skipped).toEqual([
			"ignore skipped (biome.json holds its settings)",
		]);
	});

	test("reports a new finding from a finding engine", async () => {
		const results = await runEngines(
			createOptions({
				config: parseConfig({ "comment-check": { enabled: true } }, "test"),
				runner: runnerFor({
					exitCode: 1,
					stderr: "",
					stdout: reportOutput([commentFinding]),
				}),
			}),
		);
		expect(results[0]?.status).toBe("failed");
		expect(results[0]?.reported).toHaveLength(1);
	});

	test("treats document-style-check as a finding engine", async () => {
		const results = await runEngines(
			createOptions({
				config: parseConfig(
					{ "document-style-check": { enabled: true } },
					"test",
				),
				runner: runnerFor({
					exitCode: 1,
					stderr: "",
					stdout: reportOutput([documentFinding]),
				}),
			}),
		);
		expect(results[0]?.status).toBe("failed");
		expect(results[0]?.reported).toEqual([documentFinding]);
	});

	test("keeps a baselined finding out of the report", async () => {
		const results = await runEngines(
			createOptions({
				baseline: createBaseline([commentFinding]),
				config: parseConfig({ "comment-check": { enabled: true } }, "test"),
				runner: runnerFor({
					exitCode: 1,
					stderr: "",
					stdout: reportOutput([commentFinding]),
				}),
			}),
		);
		expect(results[0]?.status).toBe("passed");
		expect(results[0]?.reported).toHaveLength(0);
		expect(results[0]?.detected).toHaveLength(1);
	});

	test("reports a new opt-in finding against the baseline", async () => {
		const results = await runEngines(
			createOptions({
				baseline: createBaseline([commentFinding]),
				config: parseConfig({ "comment-check": { enabled: true } }, "test"),
				runner: runnerFor({
					exitCode: 1,
					stderr: "",
					stdout: reportOutput([commentFinding, periodFinding]),
				}),
			}),
		);
		expect(results[0]?.status).toBe("failed");
		expect(results[0]?.reported).toEqual([periodFinding]);
		expect(results[0]?.resolved).toBe(0);
	});

	test("keeps a baselined opt-in finding out of the report", async () => {
		const results = await runEngines(
			createOptions({
				baseline: createBaseline([periodFinding]),
				config: parseConfig({ "comment-check": { enabled: true } }, "test"),
				runner: runnerFor({
					exitCode: 1,
					stderr: "",
					stdout: reportOutput([periodFinding]),
				}),
			}),
		);
		expect(results[0]?.status).toBe("passed");
		expect(results[0]?.detected).toEqual([periodFinding]);
		expect(results[0]?.reported).toEqual([]);
	});

	test("counts a resolved opt-in finding", async () => {
		const results = await runEngines(
			createOptions({
				baseline: createBaseline([periodFinding]),
				config: parseConfig({ "comment-check": { enabled: true } }, "test"),
				runner: runnerFor({
					exitCode: 0,
					stderr: "",
					stdout: reportOutput([]),
				}),
			}),
		);
		expect(results[0]?.status).toBe("passed");
		expect(results[0]?.resolved).toBe(1);
	});
	test("keeps a warning out of the report by default", async () => {
		const results = await runEngines(
			createOptions({
				config: parseConfig(
					{ "document-style-check": { enabled: true } },
					"test",
				),
				runner: runnerFor({
					exitCode: 0,
					stderr: "",
					stdout: warningOutput(documentFinding),
				}),
			}),
		);
		expect(results[0]?.status).toBe("passed");
		expect(results[0]?.warnings).toHaveLength(1);
	});

	test("turns a warning into a blocking finding with failOnWarnings", async () => {
		const results = await runEngines(
			createOptions({
				config: parseConfig(
					{
						"document-style-check": { enabled: true },
						failOnWarnings: true,
					},
					"test",
				),
				runner: runnerFor({
					exitCode: 0,
					stderr: "",
					stdout: warningOutput(documentFinding),
				}),
			}),
		);
		expect(results[0]?.status).toBe("failed");
		expect(results[0]?.reported).toEqual([
			{ ...documentFinding, severity: "error" },
		]);
		expect(results[0]?.warnings).toEqual([]);
	});

	test("marks output that is not JSON as an error", async () => {
		const results = await runEngines(
			createOptions({
				config: parseConfig({ "tsdoc-check": { enabled: true } }, "test"),
				runner: runnerFor({ exitCode: 0, stderr: "", stdout: "not json" }),
			}),
		);
		expect(results[0]?.status).toBe("error");
		expect(results[0]?.message).toBe("tsdoc-check did not print JSON");
	});
});
