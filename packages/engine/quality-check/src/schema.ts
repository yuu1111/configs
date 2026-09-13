import { ENGINE_NAMES, type EngineName, RULE_VOCABULARY } from "./config";

type JsonSchema = Record<string, unknown>;

const STRING_ARRAY: JsonSchema = {
	items: { minLength: 1, type: "string" },
	type: "array",
};

const RULE_ENGINE_NAMES: readonly string[] = [
	"comment-check",
	"document-style-check",
	"tsdoc-check",
];

const TARGET_ENGINE_NAMES: readonly string[] = [
	"biome",
	"code-style-check",
	"comment-check",
	"document-style-check",
	"tsdoc-check",
];

const IGNORE_ENGINE_NAMES: readonly string[] = [
	"code-style-check",
	"comment-check",
	"document-style-check",
	"tsdoc-check",
];

/**
 * rule1つ分の状態を許すschemaを返す
 *
 * @param promotes - 違反へ上げられるengineか
 * @returns rule1つ分の状態のschema
 */
function ruleStateSchema(promotes: boolean): JsonSchema {
	return {
		enum: promotes ? ["off", "on", "error"] : ["off", "on"],
		type: "string",
	};
}

/**
 * engine1つ分のrulesを許すschemaを返す
 *
 * @param name - rulesを組み立てるengine名
 * @returns rulesのschema
 */
function rulesSchema(name: EngineName): JsonSchema {
	const vocabulary = RULE_VOCABULARY[name];
	const properties: Record<string, unknown> = {
		preset: { enum: ["recommended", "all", "none"], type: "string" },
	};
	for (const [group, members] of Object.entries(vocabulary.groups)) {
		properties[group] = {
			anyOf: [
				ruleStateSchema(vocabulary.promotes),
				{
					additionalProperties: false,
					properties: Object.fromEntries(
						members.map((rule) => [rule, ruleStateSchema(vocabulary.promotes)]),
					),
					type: "object",
				},
			],
		};
	}
	return {
		additionalProperties: false,
		properties,
		type: "object",
	};
}

/**
 * engine1つ分のsectionを許すschemaを返す
 *
 * @param name - sectionを組み立てるengine名
 * @returns engineのsectionのschema
 */
function engineSchema(name: EngineName): JsonSchema {
	const properties: Record<string, unknown> = {
		args: STRING_ARRAY,
		enabled: { type: "boolean" },
	};
	if (TARGET_ENGINE_NAMES.includes(name)) {
		properties.targets = STRING_ARRAY;
	}
	if (IGNORE_ENGINE_NAMES.includes(name)) {
		properties.ignore = STRING_ARRAY;
	}
	if (name === "typecheck") {
		properties.projects = STRING_ARRAY;
	}
	if (RULE_ENGINE_NAMES.includes(name)) {
		properties.rules = rulesSchema(name);
	}
	return {
		additionalProperties: false,
		properties,
		type: "object",
	};
}

/**
 * quality.jsonを検証するJSON Schemaを組み立てる
 *
 * @returns quality.jsonのJSON Schema
 */
export function buildSchema(): JsonSchema {
	const properties: Record<string, unknown> = {
		$schema: { type: "string" },
		baseline: {
			anyOf: [{ minLength: 1, type: "string" }, { const: false }],
		},
		failOnWarnings: { type: "boolean" },
	};
	for (const name of ENGINE_NAMES) {
		properties[name] = engineSchema(name);
	}
	return {
		$schema: "https://json-schema.org/draft/2020-12/schema",
		additionalProperties: false,
		description: "quality-checkの設定 file",
		properties,
		title: "quality.json",
		type: "object",
	};
}
