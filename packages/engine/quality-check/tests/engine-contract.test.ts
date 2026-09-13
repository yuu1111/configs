import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isJsonObject } from "@yuu1111/shared/json";
import {
	ENGINE_NAMES,
	FINDING_ENGINE_NAMES,
	PROCESS_ENGINE_NAMES,
	RULE_VOCABULARY,
} from "../src/config";
import { FINDING_ENGINES } from "../src/engines";

const repositoryRoot = join(import.meta.dir, "..", "..", "..", "..");
const engineRoot = join(repositoryRoot, "packages", "engine");
const qualityCheckManifest = readManifest(join(engineRoot, "quality-check"));

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
			expect(existsSync(join(engineRoot, name, "src", "run.ts")), name).toBe(
				true,
			);
			expect(
				existsSync(join(engineRoot, name, "src", "rule-ids.ts")),
				name,
			).toBe(true);
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

	test("keeps every finding engine private and out of the published dependencies", () => {
		for (const name of FINDING_ENGINE_NAMES) {
			expect(readManifest(join(engineRoot, name)).private, name).toBe(true);
		}
		expect(qualityCheckManifest.peerDependencies).toBeUndefined();
		const dependencies = (qualityCheckManifest.dependencies ?? {}) as Record<
			string,
			string
		>;
		for (const name of FINDING_ENGINE_NAMES) {
			expect(dependencies[`@yuu1111/${name}`], name).toBeUndefined();
		}
	});
});
