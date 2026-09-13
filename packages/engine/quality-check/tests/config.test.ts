import { describe, expect, test } from "bun:test";
import { enabledEngines, engineConfig, parseConfig } from "../src/config";

describe("quality config", () => {
	test("runs the enabled engines in registry order", () => {
		const config = parseConfig(
			{ engines: { "tsdoc-check": true, biome: true } },
			"test",
		);
		expect(enabledEngines(config)).toEqual(["biome", "tsdoc-check"]);
	});

	test("reads the conditions of an engine from the config section", () => {
		const config = parseConfig(
			{
				config: {
					"tsdoc-check": {
						ignore: ["dist"],
						rules: { "missing-doc": "error" },
					},
				},
				engines: { "tsdoc-check": true },
			},
			"test",
		);
		expect(engineConfig(config, "tsdoc-check")).toEqual({
			ignore: ["dist"],
			rules: { "missing-doc": "error" },
		});
	});

	test("reads the tsconfig paths of the type checker", () => {
		const config = parseConfig(
			{
				config: { typecheck: { projects: [".", "examples/client"] } },
				engines: { typecheck: true },
			},
			"test",
		);
		expect(engineConfig(config, "typecheck")).toEqual({
			projects: [".", "examples/client"],
		});
	});

	test("rejects the project paths outside the type checker", () => {
		expect(() =>
			parseConfig(
				{ config: { biome: { projects: ["."] } }, engines: { biome: true } },
				"test",
			),
		).toThrow("unknown option");
	});

	test("reads the rule presets of the period engines", () => {
		const config = parseConfig(
			{
				config: {
					"comment-check": { enable: true },
					"document-style-check": { enable: true },
					"tsdoc-check": { error: true },
				},
				engines: {
					"comment-check": true,
					"document-style-check": true,
					"tsdoc-check": true,
				},
			},
			"test",
		);
		expect(engineConfig(config, "comment-check")).toEqual({ enable: true });
		expect(engineConfig(config, "document-style-check")).toEqual({
			enable: true,
		});
		expect(engineConfig(config, "tsdoc-check")).toEqual({ error: true });
	});

	test("reads the rule states of the period engines", () => {
		const config = parseConfig(
			{
				config: {
					"comment-check": { rules: { "japanese-period": "on" } },
					"document-style-check": { rules: { "japanese-period": "off" } },
					"tsdoc-check": { rules: { "missing-returns": "error" } },
				},
				engines: {
					"comment-check": true,
					"document-style-check": true,
					"tsdoc-check": true,
				},
			},
			"test",
		);
		expect(engineConfig(config, "comment-check")).toEqual({
			rules: { "japanese-period": "on" },
		});
		expect(engineConfig(config, "document-style-check")).toEqual({
			rules: { "japanese-period": "off" },
		});
		expect(engineConfig(config, "tsdoc-check")).toEqual({
			rules: { "missing-returns": "error" },
		});
	});

	test("rejects the rule option outside the period engines", () => {
		expect(() =>
			parseConfig(
				{
					config: { biome: { enable: true } },
					engines: { biome: true },
				},
				"test",
			),
		).toThrow("unknown option");
		expect(() =>
			parseConfig(
				{
					config: { knip: { rules: { "placeholder-comment": "on" } } },
					engines: { knip: true },
				},
				"test",
			),
		).toThrow("unknown option");
	});

	test("rejects an unknown rule name", () => {
		expect(() =>
			parseConfig(
				{
					config: { "comment-check": { rules: { "japanese-peroid": "on" } } },
					engines: { "comment-check": true },
				},
				"test",
			),
		).toThrow("unknown rule");
	});

	test("rejects an unknown rule state", () => {
		expect(() =>
			parseConfig(
				{
					config: {
						"comment-check": { rules: { "japanese-period": "ignore" } },
					},
					engines: { "comment-check": true },
				},
				"test",
			),
		).toThrow('must be "off", "on" or "error"');
	});

	test("rejects a rule that cannot be turned off", () => {
		expect(() =>
			parseConfig(
				{
					config: {
						"comment-check": { rules: { "placeholder-comment": "off" } },
					},
					engines: { "comment-check": true },
				},
				"test",
			),
		).toThrow("cannot turn off a rule that is on by default");
	});

	test("rejects an error state outside the TSDoc engine", () => {
		expect(() =>
			parseConfig(
				{
					config: {
						"document-style-check": { rules: { "japanese-period": "error" } },
					},
					engines: { "document-style-check": true },
				},
				"test",
			),
		).toThrow("cannot treat a rule as an error");
	});

	test("rejects a rule preset that is not a boolean", () => {
		expect(() =>
			parseConfig(
				{
					config: { "comment-check": { enable: ["japanese-period"] } },
					engines: { "comment-check": true },
				},
				"test",
			),
		).toThrow("must be a boolean");
	});

	test("rejects a rule map that is not an object", () => {
		expect(() =>
			parseConfig(
				{
					config: { "comment-check": { rules: ["japanese-period"] } },
					engines: { "comment-check": true },
				},
				"test",
			),
		).toThrow("must be an object");
	});

	test("rejects an empty project list", () => {
		expect(() =>
			parseConfig(
				{
					config: { typecheck: { projects: [] } },
					engines: { typecheck: true },
				},
				"test",
			),
		).toThrow("must not be empty");
	});

	test("gives an enabled engine without conditions an empty object", () => {
		const config = parseConfig({ engines: { biome: true } }, "test");
		expect(engineConfig(config, "biome")).toEqual({});
	});

	test("gives a disabled engine null", () => {
		const config = parseConfig(
			{ engines: { biome: true, knip: false } },
			"test",
		);
		expect(engineConfig(config, "knip")).toBeNull();
	});

	test("rejects an unknown engine", () => {
		expect(() => parseConfig({ engines: { eslint: true } }, "test")).toThrow(
			"unknown engine",
		);
	});

	test("rejects a config without an enabled engine", () => {
		expect(() => parseConfig({ engines: { biome: false } }, "test")).toThrow(
			"at least one engine",
		);
	});

	test("rejects an engine switch that is not a boolean", () => {
		expect(() =>
			parseConfig({ engines: { biome: { args: [] } } }, "test"),
		).toThrow("must be a boolean");
	});

	test("rejects an unknown engine in the config section", () => {
		expect(() =>
			parseConfig({ config: { eslint: {} }, engines: { biome: true } }, "test"),
		).toThrow("unknown engine in config");
	});

	test("rejects an unknown engine option", () => {
		expect(() =>
			parseConfig(
				{ config: { biome: { target: "src" } }, engines: { biome: true } },
				"test",
			),
		).toThrow("unknown option");
	});

	test("rejects the rule option outside the TSDoc engine", () => {
		expect(() =>
			parseConfig(
				{
					config: { biome: { error: true } },
					engines: { biome: true },
				},
				"test",
			),
		).toThrow("unknown option");
	});

	test("keeps a disabled baseline", () => {
		const config = parseConfig(
			{ baseline: false, engines: { biome: true } },
			"test",
		);
		expect(config.baseline).toBe(false);
	});

	test("rejects an empty baseline path", () => {
		expect(() =>
			parseConfig({ baseline: "", engines: { biome: true } }, "test"),
		).toThrow("baseline must be a path string or false");
	});
});
