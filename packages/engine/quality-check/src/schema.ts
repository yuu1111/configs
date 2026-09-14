import {
	docScopesOf,
	ENGINE_CAPABILITIES,
	ENGINE_NAMES,
	type EngineName,
	isRuleEngine,
	RULE_VOCABULARY,
	type RuleEngineName,
	styleScopesOf,
} from "./config";

type JsonSchema = Record<string, unknown>;

const STRING_ARRAY: JsonSchema = {
	items: { minLength: 1, type: "string" },
	type: "array",
};

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
function rulesSchema(name: RuleEngineName): JsonSchema {
	const vocabulary = RULE_VOCABULARY[name];
	const properties: Record<string, unknown> = {
		preset: { enum: ["recommended", "all", "none"], type: "string" },
	};
	for (const [group, rules] of Object.entries(vocabulary.groups)) {
		const members: readonly string[] = rules;
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
	const capabilities = ENGINE_CAPABILITIES[name];
	const properties: Record<string, unknown> = {
		enabled: { type: "boolean" },
	};
	if (capabilities.args) {
		properties.args = STRING_ARRAY;
	}
	if (capabilities.skipped.targets === undefined) {
		properties.targets = STRING_ARRAY;
	}
	if (capabilities.skipped.ignore === undefined) {
		properties.ignore = STRING_ARRAY;
	}
	if (name === "typecheck") {
		properties.projects = STRING_ARRAY;
	}
	if (isRuleEngine(name)) {
		properties.rules = rulesSchema(name);
		const docScopes = docScopesOf(name);
		if (docScopes !== undefined) {
			properties.docScope = { enum: [...docScopes], type: "string" };
		}
		const styleScopes = styleScopesOf(name);
		if (styleScopes !== undefined) {
			properties.styleScope = { enum: [...styleScopes], type: "string" };
		}
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
