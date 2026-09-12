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
				config: { "tsdoc-check": { error: ["missing-doc"], ignore: ["dist"] } },
				engines: { "tsdoc-check": true },
			},
			"test",
		);
		expect(engineConfig(config, "tsdoc-check")).toEqual({
			error: ["missing-doc"],
			ignore: ["dist"],
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

	test("reads the opt-in rules of the period engines", () => {
		const config = parseConfig(
			{
				config: {
					"comment-check": { enable: ["japanese-period"] },
					"document-style-check": { enable: ["japanese-period"] },
					"tsdoc-check": { enable: ["missing-returns"] },
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
			enable: ["japanese-period"],
		});
		expect(engineConfig(config, "document-style-check")).toEqual({
			enable: ["japanese-period"],
		});
		expect(engineConfig(config, "tsdoc-check")).toEqual({
			enable: ["missing-returns"],
		});
	});

	test("rejects the rule option outside the period engines", () => {
		expect(() =>
			parseConfig(
				{
					config: { biome: { enable: ["japanese-period"] } },
					engines: { biome: true },
				},
				"test",
			),
		).toThrow("unknown option");
		expect(() =>
			parseConfig(
				{
					config: { knip: { enable: ["japanese-period"] } },
					engines: { knip: true },
				},
				"test",
			),
		).toThrow("unknown option");
	});

	test("rejects an empty rule name", () => {
		expect(() =>
			parseConfig(
				{
					config: { "comment-check": { enable: [""] } },
					engines: { "comment-check": true },
				},
				"test",
			),
		).toThrow("must be an array of non-empty strings");
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
					config: { biome: { error: ["missing-doc"] } },
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
