import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type FindingEngineName, parseConfig } from "../src/config";
import type { FindingEngineRegistry } from "../src/engines";
import type { NormalizedFinding } from "../src/findings";
import type { EngineProcessResult, EngineRunner } from "../src/process";
import { type RunOptions, runEngines } from "../src/run";
import { createBaseline } from "../src/shared/baseline";
import type { FindingEngine } from "../src/shared/engines";
import type { Severity } from "../src/shared/findings";
import type { EngineReport, ReportFinding } from "../src/shared/report";

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
 * 正規化した検出をengineが返す報告の1件へ戻す
 */
function toReportFinding(
	finding: NormalizedFinding,
	severity: Severity,
): ReportFinding {
	return {
		column: finding.column,
		file: finding.file,
		line: finding.line,
		message: finding.text,
		rule: finding.rule,
		severity,
	};
}

/**
 * engineが返す報告を組み立てる
 *
 * @param errors - errorとして返す検出
 * @param warnings - warningとして返す検出
 * @returns severityを補った報告
 */
function reportOf(
	errors: NormalizedFinding[],
	warnings: NormalizedFinding[] = [],
): EngineReport {
	return {
		errors: errors.map((finding) => toReportFinding(finding, "error")),
		warnings: warnings.map((finding) => toReportFinding(finding, "warning")),
	};
}

/**
 * どのruleも検出しないengine実装を返す
 */
function emptyRegistry(): FindingEngineRegistry {
	const empty: FindingEngine = () => ({ errors: [], warnings: [] });
	return {
		"code-style-check": empty,
		"comment-check": empty,
		"document-style-check": empty,
		"tsdoc-check": empty,
	};
}

/**
 * 1つのengineだけが報告を返す実装を組み立てる
 */
function registryFor(
	name: FindingEngineName,
	report: EngineReport,
): FindingEngineRegistry {
	const engines = emptyRegistry();
	engines[name] = () => report;
	return engines;
}

/**
 * 1つのengineだけが例外を投げる実装を組み立てる
 */
function throwingRegistry(
	name: FindingEngineName,
	message: string,
): FindingEngineRegistry {
	const engines = emptyRegistry();
	engines[name] = () => {
		throw new Error(message);
	};
	return engines;
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

describe("rule overrides", () => {
	// 検査対象ごとにengineが受け取ったrule選択と対象fileを記録する実装を返す
	function recordingEngine(calls: { files: string[]; disable: string[] }[]) {
		const registry = emptyRegistry();
		registry["comment-check"] = (context) => {
			calls.push({
				disable: [...context.rules.disable].sort(),
				files: [...context.targets].map((file) => file.replaceAll("\\", "/")),
			});
			return { errors: [], warnings: [] };
		};
		return registry;
	}

	test("runs the engine once when no override exists", async () => {
		const calls: { files: string[]; disable: string[] }[] = [];
		await runEngines(
			createOptions({
				config: parseConfig({ "comment-check": true }, "test"),
				findingEngines: recordingEngine(calls),
			}),
		);
		expect(calls).toHaveLength(1);
	});

	test("splits the files an override selects from the others", async () => {
		const directory = mkdtempSync(join(tmpdir(), "quality-overrides-"));
		try {
			mkdirSync(join(directory, "src"));
			mkdirSync(join(directory, "tests"));
			writeFileSync(join(directory, "src", "a.ts"), "export {}\n");
			writeFileSync(join(directory, "tests", "b.ts"), "export {}\n");
			const calls: { files: string[]; disable: string[] }[] = [];
			await runEngines(
				createOptions({
					config: parseConfig(
						{
							"comment-check": {
								overrides: [
									{
										files: ["tests/**"],
										rules: { "placeholder-comment": "off" },
									},
								],
							},
						},
						"test",
					),
					cwd: directory,
					findingEngines: recordingEngine(calls),
				}),
			);
			expect(calls).toHaveLength(2);
			const withTests = calls.find((call) =>
				call.disable.includes("placeholder-comment"),
			);
			const rest = calls.find(
				(call) => !call.disable.includes("placeholder-comment"),
			);
			expect(withTests?.files.map((file) => file.split("/").at(-1))).toEqual([
				"b.ts",
			]);
			expect(rest?.files.map((file) => file.split("/").at(-1))).toEqual([
				"a.ts",
			]);
		} finally {
			rmSync(directory, { force: true, recursive: true });
		}
	});

	test("lets a later override win over an earlier one", async () => {
		const directory = mkdtempSync(join(tmpdir(), "quality-overrides-"));
		try {
			writeFileSync(join(directory, "a.ts"), "export {}\n");
			const calls: { files: string[]; disable: string[] }[] = [];
			await runEngines(
				createOptions({
					config: parseConfig(
						{
							"comment-check": {
								overrides: [
									{ files: ["**"], rules: { "placeholder-comment": "off" } },
									{ files: ["**"], rules: { "placeholder-comment": "on" } },
								],
							},
						},
						"test",
					),
					cwd: directory,
					findingEngines: recordingEngine(calls),
				}),
			);
			expect(calls).toHaveLength(1);
			expect(calls[0]?.disable).not.toContain("placeholder-comment");
		} finally {
			rmSync(directory, { force: true, recursive: true });
		}
	});
});

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
				findingEngines: registryFor(
					"comment-check",
					reportOf([commentFinding]),
				),
			}),
		);
		expect(results[0]?.status).toBe("failed");
		expect(results[0]?.reported).toHaveLength(1);
	});

	test("runs document-style-check as a finding engine", async () => {
		const results = await runEngines(
			createOptions({
				config: parseConfig(
					{ "document-style-check": { enabled: true } },
					"test",
				),
				findingEngines: registryFor(
					"document-style-check",
					reportOf([documentFinding]),
				),
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
				findingEngines: registryFor(
					"comment-check",
					reportOf([commentFinding]),
				),
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
				findingEngines: registryFor(
					"comment-check",
					reportOf([commentFinding, periodFinding]),
				),
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
				findingEngines: registryFor("comment-check", reportOf([periodFinding])),
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
				findingEngines: registryFor("comment-check", reportOf([])),
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
				findingEngines: registryFor(
					"document-style-check",
					reportOf([], [documentFinding]),
				),
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
				findingEngines: registryFor(
					"document-style-check",
					reportOf([], [documentFinding]),
				),
			}),
		);
		expect(results[0]?.status).toBe("failed");
		expect(results[0]?.reported).toEqual([
			{ ...documentFinding, severity: "error" },
		]);
		expect(results[0]?.warnings).toEqual([]);
	});

	test("marks a finding engine that throws as an error", async () => {
		const results = await runEngines(
			createOptions({
				config: parseConfig({ "tsdoc-check": { enabled: true } }, "test"),
				findingEngines: throwingRegistry("tsdoc-check", "boom"),
			}),
		);
		expect(results[0]?.status).toBe("error");
		expect(results[0]?.message).toBe("tsdoc-check could not finish: boom");
	});
});

describe("engine selection", () => {
	test("runs only the selected engines", async () => {
		const started: FindingEngineName[] = [];
		const registry = emptyRegistry();
		for (const name of ["comment-check", "document-style-check"] as const) {
			registry[name] = () => {
				started.push(name);
				return { errors: [], warnings: [] };
			};
		}
		const results = await runEngines(
			createOptions({
				config: parseConfig(
					{
						"comment-check": { enabled: true },
						"document-style-check": { enabled: true },
					},
					"test",
				),
				findingEngines: registry,
				selected: ["document-style-check"],
			}),
		);
		expect(started).toEqual(["document-style-check"]);
		expect(results.map((result) => result.name)).toEqual([
			"document-style-check",
		]);
	});

	test("rejects an engine that is not enabled", async () => {
		await expect(
			runEngines(createOptions({ selected: ["knip"] })),
		).rejects.toThrow("knip is not enabled");
	});

	test("scopes the baseline to the selected engines", async () => {
		const results = await runEngines(
			createOptions({
				baseline: createBaseline([commentFinding, documentFinding]),
				config: parseConfig(
					{
						"comment-check": { enabled: true },
						"document-style-check": { enabled: true },
					},
					"test",
				),
				findingEngines: registryFor(
					"comment-check",
					reportOf([commentFinding]),
				),
				selected: ["comment-check"],
			}),
		);
		expect(results).toHaveLength(1);
		expect(results[0]?.status).toBe("passed");
		expect(results[0]?.reported).toEqual([]);
		expect(results[0]?.resolved).toBe(0);
	});
});
