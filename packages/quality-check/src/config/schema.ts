import {
	ENGINE_CAPABILITIES,
	ENGINE_NAMES,
	type EngineName,
	isRuleEngine,
	RULE_VOCABULARY,
	type RuleEngineName,
	ruleOptionsOf,
} from "../engines/catalog";

type JsonSchema = Record<string, unknown>;

const STRING_ARRAY: JsonSchema = {
	items: { minLength: 1, type: "string" },
	type: "array",
};

/**
 * rule1つ分の状態を許すschemaを返す
 *
 * @returns rule1つ分の状態のschema
 */
function ruleStateSchema(): JsonSchema {
	return {
		description:
			"off disables the rule, on keeps its default severity, and warn or error overrides the severity.",
		enum: ["off", "on", "warn", "error"],
		type: "string",
	};
}

/**
 * ruleまたはgroupが受け取る値のschemaを返す 状態だけの文字列かlevelとoptionsを持つobject
 *
 * @param options - 受け取るoptionとその選択肢
 * @returns ruleまたはgroupの値のschema
 */
function ruleEntrySchema(
	options: Record<string, readonly string[]>,
): JsonSchema {
	const object: JsonSchema = {
		additionalProperties: false,
		properties: {
			level: ruleStateSchema(),
			...(Object.keys(options).length === 0
				? {}
				: {
						options: {
							additionalProperties: false,
							properties: Object.fromEntries(
								Object.entries(options).map(([key, values]) => [
									key,
									{ enum: [...values], type: "string" },
								]),
							),
							type: "object",
						},
					}),
		},
		type: "object",
	};
	return { anyOf: [ruleStateSchema(), object] };
}

/**
 * groupのrulesが受け取るoptionの和集合を返す
 *
 * @param name - 語彙を引くengine名
 * @param rules - groupに属するrule
 * @returns optionごとの選択肢の和集合
 */
function mergedOptions(
	name: RuleEngineName,
	rules: readonly string[],
): Record<string, readonly string[]> {
	const merged: Record<string, string[]> = {};
	for (const rule of rules) {
		for (const [key, values] of Object.entries(
			ruleOptionsOf(name)[rule] ?? {},
		)) {
			merged[key] = [...new Set([...(merged[key] ?? []), ...values])];
		}
	}
	return merged;
}

/**
 * engine1つ分のrulesを許すschemaを返す rule名とgroup名を並べて書ける
 *
 * @param name - rulesを組み立てるengine名
 * @returns rulesのschema
 */
function rulesSchema(name: RuleEngineName): JsonSchema {
	const vocabulary = RULE_VOCABULARY[name];
	const properties: Record<string, unknown> = {
		preset: {
			default: "recommended",
			description:
				"Selects the initial rule set before group and rule overrides.",
			enum: ["recommended", "all", "none"],
			type: "string",
		},
	};
	for (const [group, rules] of Object.entries(vocabulary.groups)) {
		properties[group] = {
			description: `Applies to every rule of the ${group} group.`,
			...ruleEntrySchema(mergedOptions(name, rules)),
		};
	}
	for (const rule of vocabulary.all) {
		properties[rule] = ruleEntrySchema(mergedOptions(name, [rule]));
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
		enabled: {
			default: true,
			description:
				"Whether quality-check runs this engine. A section that is present runs unless this is false.",
			type: "boolean",
		},
	};
	if (capabilities.args) {
		properties.args = STRING_ARRAY;
	}
	if (name === "typecheck") {
		properties.projects = STRING_ARRAY;
	}
	if (isRuleEngine(name)) {
		properties.includes = {
			...STRING_ARRAY,
			default: ["**"],
			description:
				"Ordered globs relative to the project root. Negative globs exclude earlier matches; later positive globs can include them again.",
		};
		properties.rules = rulesSchema(name);
		properties.overrides = {
			description:
				"Applied in order to the files their globs select; later entries win.",
			items: {
				additionalProperties: false,
				properties: {
					files: {
						...STRING_ARRAY,
						description:
							"Ordered globs relative to the project root, with the same negation rule as includes.",
						minItems: 1,
					},
					rules: rulesSchema(name),
				},
				required: ["files", "rules"],
				type: "object",
			},
			type: "array",
		};
	}
	return {
		anyOf: [
			{ type: "boolean" },
			{ additionalProperties: false, properties, type: "object" },
		],
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
		failOnWarnings: {
			default: false,
			description:
				"Treats finding-engine warnings as errors, passes --error-on-warnings to Biome, and passes --deny-warnings to Oxlint.",
			type: "boolean",
		},
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
