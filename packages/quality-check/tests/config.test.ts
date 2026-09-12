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
