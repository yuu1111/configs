import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	enabledEngines,
	engineConfig,
	loadConfig,
	parseConfig,
	RULE_VOCABULARY,
	selectionFor,
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
					includes: ["src/**", "!src/generated/**"],
					rules: { "missing-doc": "on" },
				},
			},
			"test",
		);
		expect(engineConfig(config, "tsdoc-check")?.includes).toEqual([
			"src/**",
			"!src/generated/**",
		]);
		expect(engineConfig(config, "tsdoc-check")?.rules).toEqual({
			disable: [],
			enable: ["missing-doc"],
			error: [],
			warn: [],
		});
	});

	test("reads a scope as an option of the rule", () => {
		const config = parseConfig(
			{
				"tsdoc-check": {
					rules: {
						"param-untagged": { level: "on", options: { scope: "documented" } },
					},
				},
			},
			"test",
		);
		expect(engineConfig(config, "tsdoc-check")?.rules).toEqual({
			disable: [],
			enable: ["param-untagged"],
			error: [],
			options: { "param-untagged": { scope: "documented" } },
			warn: [],
		});
	});

	test("gives a scope to every rule of a group that takes it", () => {
		const config = parseConfig(
			{
				"tsdoc-check": {
					rules: { completeness: { options: { scope: "documented" } } },
				},
			},
			"test",
		);
		const options = engineConfig(config, "tsdoc-check")?.rules.options;
		expect(options?.["param-untagged"]).toEqual({ scope: "documented" });
		expect(options?.["missing-doc"]).toBeUndefined();
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
			projects: [".", "examples/client"],
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
					rules: { "separator-comment": "off" },
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
				"blockquote-space",
				"code-span-padding",
				"consecutive-blank-lines",
				"emphasis-padding",
				"hard-break-html",
				"hard-tabs",
				"link-label-padding",
				"single-trailing-newline",
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
						"japanese-period": "off",
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
		expect(options?.rules.disable).toHaveLength(
			RULE_VOCABULARY["tsdoc-check"].all.length -
				RULE_VOCABULARY["tsdoc-check"].optIn.length,
		);
		expect(options?.rules.error).toEqual([]);
		expect(options?.rules.warn).toEqual([]);
	});

	test("changes a rule to a warning in every finding engine", () => {
		const config = parseConfig(
			{
				"comment-check": {
					enabled: true,
					rules: { "separator-comment": "warn" },
				},
			},
			"test",
		);
		expect(engineConfig(config, "comment-check")?.rules.warn).toEqual([
			"separator-comment",
		]);
	});

	test("promotes a single rule to an error", () => {
		const config = parseConfig(
			{
				"tsdoc-check": {
					enabled: true,
					rules: {
						"missing-returns": "error",
					},
				},
			},
			"test",
		);
		expect(engineConfig(config, "tsdoc-check")?.rules).toEqual({
			disable: [],
			enable: ["missing-returns"],
			error: ["missing-returns"],
			warn: [],
		});
	});

	test("promotes every rule of a group to an error", () => {
		const config = parseConfig(
			{
				"tsdoc-check": {
					enabled: true,
					rules: { completeness: "error" },
				},
			},
			"test",
		);
		const options = engineConfig(config, "tsdoc-check");
		expect(options?.rules.enable).toEqual([
			"deprecated-without-guidance",
			"missing-doc",
			"missing-returns",
			"param-order",
			"param-untagged",
			"type-param-untagged",
		]);
		expect(options?.rules.error).toEqual(options?.rules.enable);
	});

	test("runs an engine written as true", () => {
		const config = parseConfig({ biome: true, knip: false }, "test");
		expect(enabledEngines(config)).toEqual(["biome"]);
	});

	test("runs a section that leaves enabled out", () => {
		const config = parseConfig({ "comment-check": {} }, "test");
		expect(enabledEngines(config)).toEqual(["comment-check"]);
	});

	test("does not run a section that is switched off", () => {
		const config = parseConfig(
			{ biome: true, "comment-check": { enabled: false } },
			"test",
		);
		expect(enabledEngines(config)).toEqual(["biome"]);
	});

	test("reads an override with the files it applies to", () => {
		const config = parseConfig(
			{
				"comment-check": {
					overrides: [
						{ files: ["tests/**"], rules: { "placeholder-comment": "off" } },
					],
				},
			},
			"test",
		);
		const section = engineConfig(config, "comment-check");
		expect(section?.overrides).toHaveLength(1);
		expect(section?.overrides[0]?.files).toEqual(["tests/**"]);
		expect(section?.rules.disable).toEqual([]);
		expect(
			selectionFor("comment-check", [
				section?.ops ?? [],
				section?.overrides[0]?.ops ?? [],
			]).disable,
		).toEqual(["placeholder-comment"]);
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

	test("rejects an override without files", () => {
		expect(() =>
			parseConfig(
				{ "comment-check": { overrides: [{ rules: { preset: "all" } }] } },
				"test",
			),
		).toThrow(
			"test: comment-check.overrides[0].files must be a non-empty array of globs",
		);
	});

	test("rejects an override that names an unknown rule", () => {
		expect(() =>
			parseConfig(
				{
					"comment-check": {
						overrides: [{ files: ["a/**"], rules: { nope: "off" } }],
					},
				},
				"test",
			),
		).toThrow(
			"test: comment-check.overrides[0].rules has an unknown rule or group: nope",
		);
	});

	test("rejects a config without an enabled engine", () => {
		expect(() => parseConfig({ biome: { enabled: false } }, "test")).toThrow(
			"test must enable at least one engine",
		);
	});

	test("rejects an engine written as something else", () => {
		expect(() => parseConfig({ biome: "yes" }, "test")).toThrow(
			"test: biome must be an object or a boolean",
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
		).toThrow("test: comment-check.rules has an unknown rule or group: style");
	});

	test("rejects rules listed under a group", () => {
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
		).toThrow("test: comment-check.rules.shape lists rules under a group");
	});

	test("rejects an unknown rule state", () => {
		expect(() =>
			parseConfig(
				{ "comment-check": { enabled: true, rules: { shape: "fatal" } } },
				"test",
			),
		).toThrow(
			'test: comment-check.rules.shape must be "off", "on", "warn" or "error"',
		);
	});

	test("accepts an error state in every finding engine", () => {
		const config = parseConfig(
			{ "comment-check": { enabled: true, rules: { shape: "error" } } },
			"test",
		);
		expect(engineConfig(config, "comment-check")?.rules.error).toEqual([
			"cramped-comment",
			"separator-comment",
		]);
	});

	test("rejects a scope the rule does not accept", () => {
		expect(() =>
			parseConfig(
				{
					"tsdoc-check": {
						rules: { "missing-doc": { options: { scope: "documented" } } },
					},
				},
				"test",
			),
		).toThrow(
			"test: tsdoc-check.rules.missing-doc.options.scope is not accepted: documented",
		);
	});

	test("rejects an option that no rule of the group takes", () => {
		expect(() =>
			parseConfig(
				{
					"comment-check": {
						rules: { shape: { options: { scope: "all" } } },
					},
				},
				"test",
			),
		).toThrow(
			"test: comment-check.rules.shape.options.scope is not accepted: all",
		);
	});

	test("rejects the removed docScope and styleScope sections", () => {
		expect(() =>
			parseConfig({ "tsdoc-check": { docScope: "all" } }, "test"),
		).toThrow("test: tsdoc-check has an unknown option: docScope");
		expect(() =>
			parseConfig({ "tsdoc-check": { styleScope: "all" } }, "test"),
		).toThrow("test: tsdoc-check has an unknown option: styleScope");
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
