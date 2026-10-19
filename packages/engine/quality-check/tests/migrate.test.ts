import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseConfig } from "../src/config";
import { main, migrateConfig } from "../src/migrate";

const LEGACY = {
	biome: { enabled: true },
	"comment-check": {
		enabled: true,
		rules: {
			content: { "japanese-period": "on" },
			preset: "recommended",
			shape: { "cramped-comment": "on" },
		},
	},
	"document-style-check": {
		enabled: true,
		rules: { preset: "all", structure: { "first-line-heading": "off" } },
	},
	"tsdoc-check": {
		docScope: "all",
		enabled: true,
		rules: { contract: "error", preset: "all" },
		styleScope: "documented",
	},
};

describe("quality config migration", () => {
	test("rewrites an old config into one the current parser accepts", () => {
		const { config, manual } = migrateConfig(LEGACY);
		expect(manual).toEqual([]);
		expect(() => parseConfig(config, "migrated")).not.toThrow();
	});

	test("shortens an engine that only had enabled", () => {
		expect(migrateConfig(LEGACY).config.biome).toBe(true);
	});

	test("moves rules out of their group", () => {
		const section = migrateConfig(LEGACY).config["comment-check"];
		expect(section).toEqual({
			rules: { "cramped-comment": "on", "japanese-period": "on" },
		});
	});

	test("expands a renamed group to its rules", () => {
		const section = migrateConfig(LEGACY).config["tsdoc-check"] as {
			rules: Record<string, unknown>;
		};
		expect(section.rules["param-untagged"]).toMatchObject({
			level: "error",
		});
		expect(section.rules["param-mismatch"]).toBe("error");
	});

	test("turns docScope and styleScope into scopes of the rules", () => {
		const section = migrateConfig(LEGACY).config["tsdoc-check"] as {
			rules: Record<string, unknown>;
		};
		expect(section.rules["missing-doc"]).toEqual({
			options: { scope: "all" },
		});
		expect(section.rules["single-line-doc"]).toEqual({
			options: { scope: "documented" },
		});
		expect(section.rules["param-untagged"]).toEqual({
			level: "error",
			options: { scope: "documented" },
		});
	});

	test("reports what it cannot rewrite", () => {
		const { manual } = migrateConfig({
			"comment-check": { enabled: true, rules: { nope: "on" } },
		});
		expect(manual).toEqual([
			"comment-check.rules.nope: unknown rule or group; rename or remove it",
		]);
	});

	test("previews by default and writes with --write", () => {
		const directory = mkdtempSync(join(tmpdir(), "quality-migrate-"));
		try {
			const path = join(directory, "quality.json");
			writeFileSync(path, JSON.stringify(LEGACY), "utf8");
			expect(main([], directory)).toBe(0);
			expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(LEGACY);
			expect(main(["--write"], directory)).toBe(0);
			expect(JSON.parse(readFileSync(path, "utf8")).biome).toBe(true);
			expect(main(["--write"], directory)).toBe(0);
		} finally {
			rmSync(directory, { force: true, recursive: true });
		}
	});
});
