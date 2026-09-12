import { describe, expect, test } from "bun:test";
import { enabledEngines, parseConfig } from "../src/config";

describe("quality config", () => {
	test("runs the enabled engines in registry order", () => {
		const config = parseConfig(
			{ engines: { "tsdoc-check": true, biome: true } },
			"test",
		);
		expect(enabledEngines(config)).toEqual(["biome", "tsdoc-check"]);
	});

	test("keeps the arguments of an engine", () => {
		const config = parseConfig(
			{ engines: { "tsdoc-check": { args: ["--error", "missing-doc"] } } },
			"test",
		);
		expect(config.engines["tsdoc-check"]).toEqual({
			args: ["--error", "missing-doc"],
		});
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

	test("rejects an unknown engine option", () => {
		expect(() =>
			parseConfig({ engines: { biome: { target: "src" } } }, "test"),
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
