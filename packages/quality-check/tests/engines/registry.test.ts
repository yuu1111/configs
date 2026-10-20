import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	ENGINE_NAMES,
	FINDING_ENGINE_NAMES,
	PROCESS_ENGINE_NAMES,
	RULE_VOCABULARY,
} from "../../src/engines/catalog";
import { FINDING_ENGINES } from "../../src/engines/registry";
import { isJsonObject } from "../../src/utils/json";

const qualityCheckManifest = readManifest(join(import.meta.dir, "..", ".."));

/**
 * package.jsonをobjectとして読み取る
 *
 * @param directory - package.jsonを持つdirectoryのpath
 * @returns 読み取ったpackage.jsonの値
 */
function readManifest(directory: string): Record<string, unknown> {
	const value: unknown = JSON.parse(
		readFileSync(join(directory, "package.json"), "utf8"),
	);
	if (!isJsonObject(value)) {
		throw new Error(`expected a JSON object: ${directory}`);
	}
	return value;
}

describe("engine contract", () => {
	test("covers every rule of a vocabulary exactly once", () => {
		for (const name of Object.keys(
			RULE_VOCABULARY,
		) as (keyof typeof RULE_VOCABULARY)[]) {
			const vocabulary = RULE_VOCABULARY[name];
			const grouped = Object.values(vocabulary.groups)
				.flatMap((rules) => [...rules])
				.sort();
			expect(grouped, name).toEqual([...vocabulary.all].sort());
		}
	});

	test("runs every finding engine from the in-process registry", () => {
		expect(Object.keys(FINDING_ENGINES).sort()).toEqual(
			[...FINDING_ENGINE_NAMES].sort(),
		);
		for (const name of FINDING_ENGINE_NAMES) {
			expect(typeof FINDING_ENGINES[name], name).toBe("function");
		}
	});

	test("keeps the process engines out of the finding registry", () => {
		for (const name of PROCESS_ENGINE_NAMES) {
			expect(name in FINDING_ENGINES, name).toBe(false);
		}
	});

	test("lists every engine exactly once", () => {
		expect([...ENGINE_NAMES].sort()).toEqual(
			[...PROCESS_ENGINE_NAMES, ...FINDING_ENGINE_NAMES].sort(),
		);
	});

	test("ships the bundled engines without runtime dependencies", () => {
		expect(qualityCheckManifest.peerDependencies).toBeUndefined();
		expect(Object.keys(qualityCheckManifest.dependencies ?? {})).toEqual([]);
	});
});
