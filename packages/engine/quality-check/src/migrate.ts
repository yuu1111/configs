import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgv } from "@yuu1111/shared/cli";
import {
	FINDING_ENGINE_NAMES,
	findConfigFile,
	RULE_VOCABULARY,
} from "./config";

type JsonObject = Record<string, unknown>;

/**
 * 移行前のgroupとそのrule group名を変えたengineだけが持つ
 */
const LEGACY_GROUPS: Record<string, Record<string, readonly string[]>> = {
	"document-style-check": {
		structure: [
			"blockquote-blank",
			"code-fence-language",
			"command-prompt",
			"duplicate-heading",
			"emphasis-as-heading",
			"fence-blank-lines",
			"fence-style",
			"first-line-heading",
			"heading-blank-lines",
			"heading-indent",
			"heading-level-jump",
			"heading-space",
			"heading-trailing-punctuation",
			"indented-code-block",
			"list-blank-lines",
			"list-indent",
			"list-marker-consistency",
			"list-marker-space",
			"ordered-list-marker",
			"setext-heading",
			"single-top-level-heading",
			"table-blank-lines",
			"table-column-count",
			"table-style",
			"thematic-break-style",
		],
		typography: [
			"emphasis-marker",
			"full-width-alphanumeric",
			"japanese-comma",
			"japanese-period",
		],
	},
	"tsdoc-check": {
		contract: [
			"param-mismatch",
			"param-order",
			"param-untagged",
			"type-param-mismatch",
			"type-param-untagged",
		],
		documentation: [
			"deprecated-without-guidance",
			"missing-doc",
			"missing-returns",
		],
		syntax: [
			"blank-line-before-tags",
			"orphan-doc",
			"single-line-doc",
			"tsdoc-syntax",
			"tsdoc-tag",
		],
	},
};

/**
 * 移行前のdocScopeが従ったrule
 */
const DOC_SCOPE_RULES = [
	"deprecated-without-guidance",
	"missing-doc",
	"missing-returns",
	"param-order",
	"param-untagged",
	"type-param-untagged",
];

/**
 * 移行前のstyleScopeが従ったrule
 */
const STYLE_SCOPE_RULES = ["blank-line-before-tags", "single-line-doc"];

/**
 * 移行の結果
 */
export interface MigrationResult {
	/**
	 * 移行後の設定
	 */
	config: JsonObject;

	/**
	 * 自動で直せず 手で直す必要がある箇所
	 */
	manual: string[];
}

function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * ruleの値をlevelとoptionsを持つobjectへ広げる 状態だけの文字列はlevelになる
 *
 * @param entry - ruleの値
 * @returns levelとoptionsを持つobject
 */
function expandEntry(entry: unknown): JsonObject {
	if (typeof entry === "string") {
		return { level: entry };
	}
	return isObject(entry) ? { ...entry } : {};
}

/**
 * ruleの値へscopeを重ねる
 *
 * @param entry - ruleの値
 * @param scope - 重ねるscope
 * @returns scopeを持つrule値
 */
function withScope(entry: unknown, scope: string): JsonObject {
	const base = expandEntry(entry);
	const options = isObject(base.options) ? base.options : {};
	return { ...base, options: { ...options, scope } };
}

/**
 * 移行前のgroup1件を新しい書式へ移す
 *
 * @param entry - groupの値
 * @param members - groupに属するrule
 * @param renamed - groupが廃止されたか
 * @returns 移した先のrule値とgroupの値 groupの値が残らなければundefined
 */
function moveGroup(
	entry: unknown,
	members: readonly string[],
	renamed: boolean,
): { group?: unknown; manual?: string; rules: JsonObject } {
	const rules: JsonObject = {};
	if (typeof entry === "string") {
		if (!renamed) {
			return { group: entry, rules };
		}
		for (const rule of members) {
			rules[rule] = entry;
		}
		return { rules };
	}
	if (!isObject(entry)) {
		return { group: entry, manual: "expected a state or an object", rules };
	}
	for (const [rule, state] of Object.entries(entry)) {
		if (!members.includes(rule)) {
			return {
				group: entry,
				manual: `${rule} is not a rule of this group`,
				rules,
			};
		}
		rules[rule] = state;
	}
	return { rules };
}

/**
 * rules内のgroupまたはruleまたはpreset1件の移行結果
 */
interface RuleMove {
	/**
	 * 新しい書式でもgroupとして残す値
	 */
	kept?: [string, unknown] | undefined;

	/**
	 * 手作業の案内
	 */
	manual?: string | undefined;

	/**
	 * rule直下へ移したrule値
	 */
	rules: JsonObject;
}

/**
 * rules内の1件を新しい書式へ移す
 *
 * @param key - preset、group、ruleのいずれかの名前
 * @param entry - 渡された値
 * @param vocabulary - 移行先の語彙
 * @param legacy - 廃止されたgroupとそのrule
 * @returns 移行結果
 */
function moveRuleEntry(
	key: string,
	entry: unknown,
	vocabulary: {
		all: readonly string[];
		groups: Record<string, readonly string[]>;
	},
	legacy: Record<string, readonly string[]>,
): RuleMove {
	if (key === "preset") {
		return {
			kept: entry === "recommended" ? undefined : [key, entry],
			rules: {},
		};
	}
	const members = legacy[key] ?? vocabulary.groups[key];
	if (members !== undefined) {
		const moved = moveGroup(entry, members, legacy[key] !== undefined);
		return {
			kept: moved.group === undefined ? undefined : [key, moved.group],
			manual: moved.manual,
			rules: moved.rules,
		};
	}
	if (vocabulary.all.includes(key)) {
		return { rules: { [key]: entry } };
	}
	return {
		kept: [key, entry],
		manual: "unknown rule or group; rename or remove it",
		rules: {},
	};
}

/**
 * rulesを新しい書式へ移す
 *
 * @param engine - rulesを持つengine名
 * @param rules - 移行前のrules
 * @param manual - 手作業の案内の追加先
 * @returns 新しい書式のrules
 */
function migrateRules(
	engine: string,
	rules: JsonObject,
	manual: string[],
): JsonObject {
	const vocabulary: {
		all: readonly string[];
		groups: Record<string, readonly string[]>;
	} = RULE_VOCABULARY[engine as keyof typeof RULE_VOCABULARY];
	const legacy = LEGACY_GROUPS[engine] ?? {};
	const kept: JsonObject = {};
	const moved: JsonObject = {};
	for (const [key, entry] of Object.entries(rules)) {
		const move = moveRuleEntry(key, entry, vocabulary, legacy);
		Object.assign(moved, move.rules);
		if (move.kept !== undefined) {
			kept[move.kept[0]] = move.kept[1];
		}
		if (move.manual !== undefined) {
			manual.push(`${engine}.rules.${key}: ${move.manual}`);
		}
	}
	return { ...kept, ...moved };
}

/**
 * 移行前のscope1つをそのscopeに従ったruleのscopeへ移す
 *
 * @param name - docScopeかstyleScope
 * @param value - scopeの値
 * @param ruleNames - scopeに従ったrule
 * @param rules - 移行後のrules 書き換える
 * @param manual - 手作業の案内の追加先
 */
function moveScope(
	name: string,
	value: unknown,
	ruleNames: readonly string[],
	rules: JsonObject,
	manual: string[],
): void {
	if (value === undefined || value === "exported") {
		return;
	}
	if (value !== "documented" && value !== "all") {
		manual.push(`tsdoc-check.${name}: unknown value ${String(value)}`);
		return;
	}
	for (const rule of ruleNames) {
		if (rule !== "missing-doc") {
			rules[rule] = withScope(rules[rule], "documented");
		} else if (value === "all") {
			rules[rule] = withScope(rules[rule], "all");
		}
	}
}

/**
 * 移行前のdocScopeとstyleScopeをruleごとのscopeへ移す
 *
 * @param section - tsdoc-checkのsection
 * @param rules - 移行後のrules 書き換える
 * @param manual - 手作業の案内の追加先
 */
function migrateScopes(
	section: JsonObject,
	rules: JsonObject,
	manual: string[],
): void {
	moveScope("docScope", section.docScope, DOC_SCOPE_RULES, rules, manual);
	moveScope("styleScope", section.styleScope, STYLE_SCOPE_RULES, rules, manual);
}

/**
 * 検出engineのsection1つを新しい書式へ移す
 *
 * @param name - engine名
 * @param section - 移行前のsection
 * @param manual - 手作業の案内の追加先
 * @returns 移行後のsection
 */
function migrateEngine(
	name: string,
	section: JsonObject,
	manual: string[],
): unknown {
	const {
		docScope: _doc,
		enabled,
		rules: legacyRules,
		styleScope: _style,
		...rest
	} = section;
	const next: JsonObject = enabled === false ? { enabled: false } : {};
	Object.assign(next, rest);
	const rules = isObject(legacyRules)
		? migrateRules(name, legacyRules, manual)
		: {};
	if (name === "tsdoc-check") {
		migrateScopes(section, rules, manual);
	}
	if (Object.keys(rules).length > 0) {
		next.rules = rules;
	}
	return Object.keys(next).length === 0 ? true : next;
}

/**
 * 検出engine以外のsectionを短い書式へ移す
 *
 * @param section - 移行前のsection
 * @returns 移行後のsection
 */
function migrateSimpleSection(section: unknown): unknown {
	if (!isObject(section) || section.enabled !== true) {
		return section;
	}
	const { enabled: _enabled, ...rest } = section;
	return Object.keys(rest).length === 0 ? true : rest;
}

/**
 * 移行前のquality.jsonを新しい書式へ移す
 *
 * @param value - 移行前の設定
 * @returns 移行後の設定と手作業の案内
 */
export function migrateConfig(value: unknown): MigrationResult {
	if (!isObject(value)) {
		return { config: {}, manual: ["quality.json must be a JSON object"] };
	}
	const manual: string[] = [];
	const config: JsonObject = {};
	for (const [name, section] of Object.entries(value)) {
		const engine = (FINDING_ENGINE_NAMES as readonly string[]).includes(name);
		config[name] =
			engine && isObject(section)
				? migrateEngine(name, section, manual)
				: migrateSimpleSection(section);
	}
	return { config, manual };
}

const USAGE =
	"Usage: quality-check migrate [--config <path>] [--write]\n  Previews the rewrite of an old quality.json; --write applies it.";

/**
 * migrateコマンドの本体 既定はpreviewで --write のときだけ書き換える
 *
 * @param argv - migrateの後ろの引数
 * @param cwd - configを探す作業ディレクトリ
 * @returns 終了code 手作業が残るとき1
 */
export function main(argv: string[], cwd = process.cwd()): number {
	if (argv.includes("--help") || argv.includes("-h")) {
		console.log(USAGE);
		return 0;
	}
	const parsed = parseArgv(argv, { flags: ["write"], values: ["config"] });
	const configured = parsed.values.get("config")?.at(-1);
	const path =
		configured === undefined ? findConfigFile(cwd) : resolve(cwd, configured);
	if (path === null) {
		console.error(`quality.json not found in ${cwd}`);
		return 2;
	}
	const before: unknown = JSON.parse(
		readFileSync(path, "utf8").replace(/^\uFEFF/, ""),
	);
	const result = migrateConfig(before);
	const after = `${JSON.stringify(result.config, null, "\t")}\n`;
	if (JSON.stringify(before) === JSON.stringify(result.config)) {
		console.log(`${path} already uses the current format`);
	} else if (parsed.flags.has("write")) {
		writeFileSync(path, after, "utf8");
		console.log(`Rewrote ${path}`);
	} else {
		console.log(`Preview of ${path} (pass --write to apply):\n${after}`);
	}
	if (result.manual.length === 0) {
		return 0;
	}
	console.error(
		["Fix these by hand:", ...result.manual.map((line) => `  ${line}`)].join(
			"\n",
		),
	);
	return 1;
}
