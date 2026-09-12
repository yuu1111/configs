import { describe, expect, test } from "bun:test";
import { createBaseline } from "../src/baseline";
import { parseConfig } from "../src/config";
import type { EngineProcessResult, EngineRunner } from "../src/engines";
import type { NormalizedFinding } from "../src/findings";
import { type RunOptions, runEngines } from "../src/run";

const commentFinding: NormalizedFinding = {
	column: 3,
	engine: "comment-check",
	file: "src/a.ts",
	line: 2,
	rule: "placeholder-comment",
	severity: "error",
	text: "TODO: one",
};

function commentOutput(findings: unknown[]): string {
	return JSON.stringify({ added: findings, resolved: [] });
}

function runnerFor(result: EngineProcessResult): EngineRunner {
	return async () => result;
}

function createOptions(overrides: Partial<RunOptions>): RunOptions {
	return {
		baseline: null,
		config: parseConfig({ engines: { biome: true } }, "test"),
		cwd: ".",
		rawBaseline: "raw.json",
		resolve: () => "/fake/bin",
		targets: ["."],
		...overrides,
	};
}

describe("engine orchestration", () => {
	test("passes a process engine that exits with 0", async () => {
		const results = await runEngines(
			createOptions({
				runner: runnerFor({ exitCode: 0, stderr: "", stdout: "clean" }),
			}),
		);
		expect(results[0]?.status).toBe("passed");
		expect(results[0]?.output).toBe("clean");
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

	test("reports an engine that is not installed", async () => {
		const results = await runEngines(createOptions({ resolve: () => null }));
		expect(results[0]?.status).toBe("error");
		expect(results[0]?.message).toBe("biome is not installed");
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
