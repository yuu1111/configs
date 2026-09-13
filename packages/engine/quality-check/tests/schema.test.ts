import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseConfig, RULE_VOCABULARY } from "../src/config";
import { buildSchema } from "../src/schema";

const schemaPath = new URL("../schema.json", import.meta.url);
const qualityJsonPath = new URL("../../../../quality.json", import.meta.url);

describe("quality schema", () => {
	test("matches the committed schema.json", () => {
		const committed = readFileSync(schemaPath, "utf8");
		expect(`${JSON.stringify(buildSchema(), null, "\t")}\n`).toBe(committed);
	});

	test("names every rule the engines publish", () => {
		const text = JSON.stringify(buildSchema());
		for (const vocabulary of Object.values(RULE_VOCABULARY)) {
			for (const rule of vocabulary.all) {
				expect(text).toContain(`"${rule}"`);
			}
		}
	});

	test("accepts the configuration of this repository", () => {
		const value: unknown = JSON.parse(readFileSync(qualityJsonPath, "utf8"));
		expect(() => parseConfig(value, "quality.json")).not.toThrow();
	});
});
