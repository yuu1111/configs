import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { application } from "../application";
import { base } from "../base";
import { library } from "../library";

const packageDirectory = join(import.meta.dir, "..");

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonObject(file: string): JsonObject {
	const value: unknown = JSON.parse(readFileSync(file, "utf8"));
	if (!isJsonObject(value)) {
		throw new Error(`${file} is not a JSON object`);
	}
	return value;
}

describe("published Knip configurations", () => {
	test("package.json exports every preset file", () => {
		const manifest = readJsonObject(join(packageDirectory, "package.json"));
		const exported = manifest.exports;
		if (!isJsonObject(exported)) {
			throw new Error("exports is not a JSON object");
		}

		expect(Object.keys(exported).sort()).toEqual([
			"./application",
			"./base",
			"./library",
		]);
		for (const target of Object.values(exported)) {
			expect(typeof target).toBe("string");
			expect(existsSync(join(packageDirectory, String(target)))).toBe(true);
		}
	});

	test("application and library inherit the base defaults", () => {
		for (const preset of [application, library]) {
			expect(preset.ignoreExportsUsedInFile).toBe(base.ignoreExportsUsedInFile);
			expect(preset.treatConfigHintsAsErrors).toBe(
				base.treatConfigHintsAsErrors,
			);
			expect(preset.treatTagHintsAsErrors).toBe(base.treatTagHintsAsErrors);
		}
	});

	test("the shared defaults fail the run on a hint", () => {
		expect(base.treatConfigHintsAsErrors).toBe(true);
		expect(base.treatTagHintsAsErrors).toBe(true);
	});

	test("only the library reports unused exports from entry files", () => {
		expect(library.includeEntryExports).toBe(true);
		expect(application.includeEntryExports).toBe(false);
	});
});
