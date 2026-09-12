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

function commentOutput(findings: unknown[]): string {
	return JSON.stringify({ added: findings, resolved: [] });
}

function documentOutput(findings: NormalizedFinding[]): string {
	return JSON.stringify({
		errors: findings.map((finding) => ({
			column: finding.column,
			file: finding.file,
			line: finding.line,
			message: finding.text,
			rule: finding.rule,
		})),
		warnings: [],
	});
}

function runnerFor(result: EngineProcessResult): EngineRunner {
	return async () => result;
}

function createOptions(overrides: Partial<RunOptions>): RunOptions {
	return {
		baseline: null,
		color: false,
		config: parseConfig({ engines: { biome: true } }, "test"),
		cwd: ".",
		overrides: { ignore: [], targets: ["."] },
		rawBaseline: "raw.json",
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
						config: { typecheck: { projects: [".", "examples/client"] } },
						engines: { typecheck: true },
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
						config: { typecheck: { projects: ["."] } },
						engines: { typecheck: true },
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
				config: parseConfig(
					{ config: { biome: { ignore: ["dist"] } }, engines: { biome: true } },
					"test",
				),
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
				config: parseConfig({ engines: { "comment-check": true } }, "test"),
				runner: runnerFor({
					exitCode: 1,
					stderr: "",
					stdout: commentOutput([commentFinding]),
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
					{ engines: { "document-style-check": true } },
					"test",
				),
				runner: runnerFor({
					exitCode: 1,
					stderr: "",
					stdout: documentOutput([documentFinding]),
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
				config: parseConfig({ engines: { "comment-check": true } }, "test"),
				runner: runnerFor({
					exitCode: 1,
					stderr: "",
					stdout: commentOutput([commentFinding]),
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
				config: parseConfig({ engines: { "comment-check": true } }, "test"),
				runner: runnerFor({
					exitCode: 1,
					stderr: "",
					stdout: commentOutput([commentFinding, periodFinding]),
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
				config: parseConfig({ engines: { "comment-check": true } }, "test"),
				runner: runnerFor({
					exitCode: 1,
					stderr: "",
					stdout: commentOutput([periodFinding]),
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
				config: parseConfig({ engines: { "comment-check": true } }, "test"),
				runner: runnerFor({
					exitCode: 0,
					stderr: "",
					stdout: commentOutput([]),
				}),
			}),
		);
		expect(results[0]?.status).toBe("passed");
		expect(results[0]?.resolved).toBe(1);
	});

	test("marks output that is not JSON as an error", async () => {
		const results = await runEngines(
			createOptions({
				config: parseConfig({ engines: { "tsdoc-check": true } }, "test"),
				runner: runnerFor({ exitCode: 0, stderr: "", stdout: "not json" }),
			}),
		);
		expect(results[0]?.status).toBe("error");
		expect(results[0]?.message).toBe("tsdoc-check did not print JSON");
	});
});
