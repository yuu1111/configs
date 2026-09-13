import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isJsonObject } from "@yuu1111/shared/json";
import { ENGINE_NAMES, isRuleEngine, RULE_VOCABULARY } from "../src/config";

const repositoryRoot = join(import.meta.dir, "..", "..", "..", "..");
const engineRoot = join(repositoryRoot, "packages", "engine");
const qualityCheckManifest = readManifest(join(engineRoot, "quality-check"));
const ruleEngines = ENGINE_NAMES.filter((name) => isRuleEngine(name));

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
		for (const name of ruleEngines) {
			const vocabulary = RULE_VOCABULARY[name];
			const grouped = Object.values(vocabulary.groups)
				.flatMap((rules) => [...rules])
				.sort();
			expect(grouped, name).toEqual([...vocabulary.all].sort());
		}
	});

	test("publishes the rule ids of every rule engine", () => {
		for (const name of ruleEngines) {
			const manifest = readManifest(join(engineRoot, name));
			const entries = manifest.exports as Record<string, string>;
			const files = manifest.files as string[];
			expect(entries["./rule-ids"], name).toBe("./src/rule-ids.ts");
			expect(files, name).toContain("src/rule-ids.ts");
		}
	});

	test("declares every rule engine as a peer dependency", () => {
		const peers = qualityCheckManifest.peerDependencies as Record<
			string,
			string
		>;
		for (const name of ruleEngines) {
			expect(peers[`@yuu1111/${name}`], name).toBeString();
		}
	});

	test("reads the rule ids of every peer engine at runtime", () => {
		const scripts = qualityCheckManifest.scripts as Record<string, string>;
		const build = scripts.build ?? "";
		for (const name of ruleEngines) {
			expect(build, name).toContain(`--external @yuu1111/${name}/rule-ids`);
		}
	});
});
