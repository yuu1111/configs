import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	enabledEngines,
	engineConfig,
	loadConfig,
	parseConfig,
} from "../src/config";

describe("quality config", () => {
	test("runs the enabled engines in registry order", () => {
		const config = parseConfig(
			{
				biome: { enabled: true },
				"tsdoc-check": { enabled: true },
			},
			"test",
		);
		expect(enabledEngines(config)).toEqual(["biome", "tsdoc-check"]);
	});

	test("gives a disabled engine null", () => {
		const config = parseConfig(
			{
				biome: { enabled: true },
				knip: { enabled: false },
			},
			"test",
		);
		expect(engineConfig(config, "knip")).toBeNull();
	});

	test("reads the conditions of an engine from its section", () => {
		const config = parseConfig(
			{
				"tsdoc-check": {
					enabled: true,
					ignore: ["dist"],
					rules: { documentation: { "missing-doc": "on" } },
				},
			},
			"test",
		);
		expect(engineConfig(config, "tsdoc-check")).toEqual({
			ignore: ["dist"],
			rules: { disable: [], enable: [], error: [] },
			targets: [],
		});
	});

	test("reads the tsconfig paths of the type checker", () => {
		const config = parseConfig(
			{
				typecheck: {
					enabled: true,
					projects: [".", "examples/client"],
				},
			},
			"test",
		);
		expect(engineConfig(config, "typecheck")).toEqual({
			args: [],
			ignore: [],
			projects: [".", "examples/client"],
			targets: [],
		});
	});

	test("enables every opt-in rule with the all preset", () => {
		const config = parseConfig(
			{
				"comment-check": {
					enabled: true,
					rules: { preset: "all" },
				},
			},
			"test",
		);
		const options = engineConfig(config, "comment-check");
		expect(options?.rules.enable).toEqual([
			"cramped-comment",
			"japanese-period",
		]);
		expect(options?.rules.disable).toEqual([]);
	});

	test("turns a rule that is on by default off", () => {
		const config = parseConfig(
			{
				"comment-check": {
					enabled: true,
					rules: { shape: { "separator-comment": "off" } },
				},
			},
			"test",
		);
		expect(engineConfig(config, "comment-check")?.rules.disable).toEqual([
			"separator-comment",
		]);
	});

	test("turns a whole group off", () => {
		const config = parseConfig(
			{
				"document-style-check": {
					enabled: true,
					rules: { whitespace: "off" },
				},
			},
			"test",
		);
		expect(engineConfig(config, "document-style-check")?.rules.disable).toEqual(
			[
				"consecutive-blank-lines",
				"hard-break-html",
				"trailing-backslash",
				"trailing-whitespace",
			],
		);
	});

	test("turns a group on and then one rule inside it off", () => {
		const config = parseConfig(
			{
				"comment-check": {
					enabled: true,
					rules: {
						content: { "japanese-period": "off" },
						preset: "all",
					},
				},
			},
			"test",
		);
		expect(engineConfig(config, "comment-check")?.rules.enable).toEqual([
			"cramped-comment",
		]);
	});

	test("turns every rule off with the none preset", () => {
		const config = parseConfig(
			{
				"tsdoc-check": {
					enabled: true,
					rules: { preset: "none" },
				},
			},
			"test",
		);
		const options = engineConfig(config, "tsdoc-check");
		expect(options?.rules.enable).toEqual([]);
		expect(options?.rules.disable).toHaveLength(10);
		expect(options?.rules.error).toEqual([]);
	});

	test("promotes a single rule to an error", () => {
		const config = parseConfig(
			{
				"tsdoc-check": {
					enabled: true,
					rules: {
						documentation: { "missing-returns": "error" },
					},
				},
			},
			"test",
		);
		expect(engineConfig(config, "tsdoc-check")?.rules).toEqual({
			disable: [],
			enable: ["missing-returns"],
			error: ["missing-returns"],
		});
	});

	test("promotes every rule of a group to an error", () => {
		const config = parseConfig(
			{
				"tsdoc-check": {
					enabled: true,
					rules: { contract: "error" },
				},
			},
			"test",
		);
		const options = engineConfig(config, "tsdoc-check");
		expect(options?.rules.enable).toEqual(["param-order"]);
		expect(options?.rules.error).toEqual([
			"param-mismatch",
			"param-order",
			"param-untagged",
			"type-param-mismatch",
			"type-param-untagged",
		]);
	});

	test("defaults the baseline to the conventional file", () => {
		const config = parseConfig({ biome: { enabled: true } }, "test");
		expect(config.baseline).toBe("quality-baseline.json");
	});

	test("keeps a disabled baseline", () => {
		const config = parseConfig(
			{
				baseline: false,
				biome: { enabled: true },
			},
			"test",
		);
		expect(config.baseline).toBe(false);
	});

	test("reads failOnWarnings", () => {
		const config = parseConfig(
			{
				biome: { enabled: true },
				failOnWarnings: true,
			},
			"test",
		);
		expect(config.failOnWarnings).toBe(true);
	});
});

describe("quality config errors", () => {
	test("rejects an unknown engine", () => {
		expect(() => parseConfig({ eslint: { enabled: true } }, "test")).toThrow(
			"test has an unknown option: eslint",
		);
	});

	test("rejects an option that the engine cannot take", () => {
		expect(() =>
			parseConfig({ biome: { enabled: true, ignore: ["dist"] } }, "test"),
		).toThrow("test: biome has an unknown option: ignore");
	});

	test("rejects a config without an enabled engine", () => {
		expect(() => parseConfig({ biome: { enabled: false } }, "test")).toThrow(
			"test must enable at least one engine",
		);
	});

	test("rejects an enabled switch that is not a boolean", () => {
		expect(() => parseConfig({ biome: { enabled: "yes" } }, "test")).toThrow(
			"test: biome.enabled must be a boolean",
		);
	});

	test("rejects an unknown rule group", () => {
		expect(() =>
			parseConfig(
				{ "comment-check": { enabled: true, rules: { style: {} } } },
				"test",
			),
		).toThrow("test: comment-check.rules has an unknown rule group: style");
	});

	test("rejects a rule that belongs to another group", () => {
		expect(() =>
			parseConfig(
				{
					"comment-check": {
						enabled: true,
						rules: { shape: { "japanese-period": "on" } },
					},
				},
				"test",
			),
		).toThrow(
			"test: comment-check.rules.shape has an unknown rule: japanese-period",
		);
	});

	test("rejects an unknown rule state", () => {
		expect(() =>
			parseConfig(
				{ "comment-check": { enabled: true, rules: { shape: "warn" } } },
				"test",
			),
		).toThrow('test: comment-check.rules.shape must be "off", "on" or "error"');
	});

	test("rejects an error state outside the TSDoc engine", () => {
		expect(() =>
			parseConfig(
				{ "comment-check": { enabled: true, rules: { shape: "error" } } },
				"test",
			),
		).toThrow(
			"test: comment-check.rules.shape cannot treat a rule as an error",
		);
	});

	test("rejects a preset that is not a known preset", () => {
		expect(() =>
			parseConfig(
				{ "comment-check": { enabled: true, rules: { preset: true } } },
				"test",
			),
		).toThrow(
			'test: comment-check.rules.preset must be "recommended", "all" or "none"',
		);
	});

	test("rejects an empty baseline path", () => {
		expect(() =>
			parseConfig({ baseline: "", biome: { enabled: true } }, "test"),
		).toThrow("test: baseline must be a path string or false");
	});

	test("rejects a config that is not an object", () => {
		expect(() => parseConfig([], "test")).toThrow("test must be a JSON object");
	});
});
describe("quality config file", () => {
	test("loads a JSON file and ignores the schema key", () => {
		const directory = mkdtempSync(join(tmpdir(), "quality-check-"));
		try {
			const path = join(directory, "quality.json");
			writeFileSync(
				path,
				JSON.stringify({
					$schema: "./schema.json",
					biome: { enabled: true },
				}),
				"utf8",
			);
			expect(enabledEngines(loadConfig(path))).toEqual(["biome"]);
		} finally {
			rmSync(directory, { force: true, recursive: true });
		}
	});

	test("rejects a file that is not JSON", () => {
		const directory = mkdtempSync(join(tmpdir(), "quality-check-"));
		try {
			const path = join(directory, "quality.json");
			writeFileSync(path, "not json", "utf8");
			expect(() => loadConfig(path)).toThrow();
		} finally {
			rmSync(directory, { force: true, recursive: true });
		}
	});
});
