import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../../src/cli/commands/migrate";
import { migrateConfig } from "../../src/config/migrate";
import { parseConfig } from "../../src/config/parse";

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
	test("renames flat v6 engine keys without changing defaults, rules, options or overrides", () => {
		const input = {
			"code-style-check": { rules: { spacing: "off" } },
			"comment-check": { enabled: true, rules: { content: "on" } },
			"document-style-check": false,
			"tsdoc-check": {
				rules: {
					suppression: "off",
					completeness: { options: { scope: "documented" } },
				},
				overrides: [{ files: ["test/**"], rules: { "missing-doc": "off" } }],
			},
		};
		const expected = {
			code: input["code-style-check"],
			comment: input["comment-check"],
			markdown: false,
			tsdoc: input["tsdoc-check"],
		};
		expect(migrateConfig(input)).toEqual({ config: expected, manual: [] });
		expect(() => parseConfig(expected, "migrated")).not.toThrow();
		expect(migrateConfig(expected)).toEqual({ config: expected, manual: [] });
	});

	test("does not reinterpret clearly flat suppression as a historical group", () => {
		const section = { rules: { suppression: "off", "missing-doc": "on" } };
		expect(migrateConfig({ "tsdoc-check": section })).toEqual({
			config: { tsdoc: section },
			manual: [],
		});
	});

	test("keeps canonical empty sections idempotent with current enabled defaults", () => {
		const config = { code: {}, comment: {}, markdown: {}, tsdoc: {} };
		expect(migrateConfig(config)).toEqual({ config, manual: [] });
		expect(parseConfig(config, "current").engines.tsdoc).toBe(true);
	});

	test.each([false, { rules: { suppression: "off" } }])(
		"rejects old/new key collisions without writing even when values equal %j",
		(section) => {
			const directory = mkdtempSync(
				join(tmpdir(), "quality-migrate-collision-"),
			);
			try {
				const config = { "tsdoc-check": section, tsdoc: section };
				const result = migrateConfig(config);
				expect(result.config).toEqual(config);
				expect(result.manual.join("\n")).toMatch(
					/tsdoc-check.*tsdoc.*(collision|both|conflict)/,
				);
				const path = join(directory, "quality.json");
				const before = JSON.stringify(config);
				writeFileSync(path, before, "utf8");
				expect(main(["--write"], directory)).toBe(1);
				expect(main(["--from-v5", "--write"], directory)).toBe(1);
				expect(readFileSync(path, "utf8")).toBe(before);
			} finally {
				rmSync(directory, { force: true, recursive: true });
			}
		},
	);

	test("rewrites an old config into one the current parser accepts", () => {
		const { config, manual } = migrateConfig(LEGACY);
		expect(manual).toEqual([]);
		expect(() => parseConfig(config, "migrated")).not.toThrow();
	});

	test("shortens an engine that only had enabled", () => {
		expect(migrateConfig(LEGACY).config.biome).toBe(true);
	});

	test("moves rules out of their group", () => {
		const section = migrateConfig(LEGACY).config.comment;
		expect(section).toEqual({
			rules: { "cramped-comment": "on", "japanese-period": "on" },
		});
	});

	test("expands a renamed group to its rules", () => {
		const section = migrateConfig(LEGACY).config.tsdoc as {
			rules: Record<string, unknown>;
		};
		expect(section.rules["param-untagged"]).toMatchObject({
			level: "error",
		});
		expect(section.rules["param-mismatch"]).toBe("error");
	});

	test("turns docScope and styleScope into scopes of the rules", () => {
		const section = migrateConfig(LEGACY).config.tsdoc as {
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
		const { manual } = migrateConfig(
			{
				"comment-check": { enabled: true, rules: { nope: "on" } },
			},
			true,
		);
		expect(manual).toEqual([
			"comment-check.rules.nope: unknown rule or group; rename or remove it",
		]);
	});

	test("preserves engines disabled by the legacy default on repeated migration", () => {
		const { config, manual } = migrateConfig(
			{
				biome: { enabled: true, args: ["--verbose"] },
				knip: {},
				"tsdoc-check": {},
			},
			true,
		);
		expect(manual).toEqual([]);
		expect(parseConfig(config, "migrated").engines).toMatchObject({
			biome: true,
			knip: false,
			tsdoc: false,
		});
		expect(migrateConfig(config)).toEqual({ config, manual: [] });
	});

	test("keeps current group options and rule-only suppression on repeated migration", () => {
		const current = {
			tsdoc: {
				rules: {
					completeness: { options: { scope: "documented" } },
					suppression: "off",
				},
			},
		};
		expect(migrateConfig(current)).toEqual({ config: current, manual: [] });
	});

	test.each([
		[{ suppression: "off" }, ["suppression"]],
		["off", ["suppression", "suppression-unused"]],
	])(
		"preserves the rules selected by the legacy suppression group %j",
		(entry, disabled) => {
			const { config, manual } = migrateConfig(
				{
					"tsdoc-check": { enabled: true, rules: { suppression: entry } },
				},
				typeof entry === "string",
			);
			expect(manual).toEqual([]);
			expect(
				parseConfig(config, "migrated").config.tsdoc?.rules.disable,
			).toEqual(disabled);
			expect(migrateConfig(config)).toEqual({ config, manual: [] });
		},
	);

	test("asks for an explicit enabled value when the format is ambiguous", () => {
		const config = { "comment-check": {} };
		const result = migrateConfig(config);
		expect(result.config).toEqual(config);
		expect(result.manual.join("\n")).toContain("--from-v5");
	});

	test.each([
		{ biome: { enabled: true }, "comment-check": {} },
		{ "tsdoc-check": { enabled: true, rules: { suppression: "off" } } },
	])(
		"requires explicit v5 mode instead of reinterpreting a current config %j",
		(config) => {
			const directory = mkdtempSync(
				join(tmpdir(), "quality-migrate-ambiguous-"),
			);
			try {
				const path = join(directory, "quality.json");
				const before = JSON.stringify(config);
				writeFileSync(path, before, "utf8");
				expect(main(["--write"], directory)).toBe(1);
				expect(readFileSync(path, "utf8")).toBe(before);
				expect(main(["--from-v5", "--write"], directory)).toBe(0);
				const migrated = parseConfig(
					JSON.parse(readFileSync(path, "utf8")),
					"migrated",
				);
				if ("biome" in config) {
					expect(migrated.engines.comment).toBe(false);
				} else {
					expect(migrated.config.tsdoc?.rules.disable).toEqual([
						"suppression",
						"suppression-unused",
					]);
				}
			} finally {
				rmSync(directory, { force: true, recursive: true });
			}
		},
	);

	test.each([
		{ biome: true, "tsdoc-check": { docScope: "all" } },
		{
			oxlint: true,
			"tsdoc-check": { enabled: true, docScope: "all" },
			"comment-check": { rules: { "japanese-period": "on" } },
		},
	])(
		"rejects mixed formats whose omitted enabled value is ambiguous %j",
		(config) => {
			const result = migrateConfig(config);
			expect(result.manual.join("\n")).toContain("--from-v5");
			expect(result.config).toEqual(config);
		},
	);

	test("leaves newly introduced engines enabled while migrating legacy sections", () => {
		const result = migrateConfig(
			{
				"tsdoc-check": { enabled: true, docScope: "all" },
				oxlint: {},
				oxfmt: { args: ["--check"] },
			},
			true,
		);
		expect(result.manual).toEqual([]);
		expect(result.config.oxlint).toEqual({});
		expect(result.config.oxfmt).toEqual({ args: ["--check"] });
		expect(migrateConfig(result.config)).toEqual(result);
	});

	test.each([
		{ enabled: true, docScope: "custom" },
		{ enabled: "bad", docScope: "all" },
		{ enabled: true, rules: "bad", docScope: "all" },
	])(
		"does not write any changes when manual migration remains %j",
		(section) => {
			const directory = mkdtempSync(join(tmpdir(), "quality-migrate-manual-"));
			try {
				const path = join(directory, "quality.json");
				const before = JSON.stringify({
					biome: { enabled: true },
					"tsdoc-check": section,
				});
				writeFileSync(path, before, "utf8");
				expect(main(["--write"], directory)).toBe(1);
				expect(readFileSync(path, "utf8")).toBe(before);
			} finally {
				rmSync(directory, { force: true, recursive: true });
			}
		},
	);

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
