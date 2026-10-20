import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgv } from "@yuu1111/shared/cli";
import {
	FINDING_ENGINE_NAMES,
	findConfigFile,
	RULE_VOCABULARY,
} from "./config";

type JsonObject = Record<string, unknown>;

const LEGACY_ENGINE_NAMES = [
	"biome",
	"typecheck",
	"knip",
	"code-style-check",
	"comment-check",
	"document-style-check",
	"tsdoc-check",
];

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
		suppression: ["suppression", "suppression-unused"],
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
		rules[rule] =
			rule === "suppression" && typeof state === "string"
				? { level: state }
				: state;
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
	const next: JsonObject = enabled === true ? {} : { enabled: false };
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
	if (Object.keys(next).length === 0) {
		return true;
	}
	return enabled === true && !hasCurrentConfig({ [name]: next })
		? { enabled: true, ...next }
		: next;
}

/**
 * 検出engine以外のsectionを短い書式へ移す
 *
 * @param section - 移行前のsection
 * @returns 移行後のsection
 */
function migrateSimpleSection(section: unknown): unknown {
	if (!isObject(section)) {
		return section;
	}
	if (section.enabled !== true) {
		return { ...section, enabled: false };
	}
	const { enabled: _enabled, ...rest } = section;
	return Object.keys(rest).length === 0 ? true : { enabled: true, ...rest };
}

/**
 * 旧書式の証拠があるか調べる enabled省略だけのsectionは新旧を区別できないため変更しない
 *
 * @param value - 調べる設定
 * @returns 旧書式の証拠があればtrue
 */
function hasLegacyConfig(value: JsonObject): boolean {
	return LEGACY_ENGINE_NAMES.some((name) => {
		const section = value[name];
		if (!isObject(section)) {
			return false;
		}
		if ("docScope" in section || "styleScope" in section) {
			return true;
		}
		if (!isObject(section.rules)) {
			return false;
		}
		const groups = LEGACY_GROUPS[name] ?? {};
		return Object.entries(section.rules).some(
			([key, entry]) =>
				(key !== "suppression" && Object.hasOwn(groups, key)) ||
				(isObject(entry) &&
					Object.keys(entry).some(
						(field) => field !== "level" && field !== "options",
					)),
		);
	});
}

/**
 * 新書式だけが持つ指定があるか調べる
 *
 * @param value - 調べる設定
 * @returns 新書式だけが持つ指定があればtrue
 */
function hasCurrentConfig(value: JsonObject): boolean {
	return LEGACY_ENGINE_NAMES.some((name) => {
		const section = value[name];
		if (typeof section === "boolean") {
			return true;
		}
		if (!isObject(section)) {
			return false;
		}
		if ("overrides" in section) {
			return true;
		}
		if (!isObject(section.rules)) {
			return false;
		}
		const vocabulary = RULE_VOCABULARY[name as keyof typeof RULE_VOCABULARY];
		return Object.entries(section.rules).some(
			([key, entry]) =>
				((vocabulary?.all as readonly string[] | undefined)?.includes(key) &&
					key !== "suppression") ||
				(key !== "preset" &&
					Object.hasOwn(vocabulary?.groups ?? {}, key) &&
					!Object.hasOwn(LEGACY_GROUPS[name] ?? {}, key) &&
					![
						"whitespace",
						"content",
						"shape",
						"spacing",
						"suppression",
					].includes(key)) ||
				(isObject(entry) && ("level" in entry || "options" in entry)),
		);
	});
}

/**
 * 移行が値を失わず扱える型か検証する
 *
 * @param value - 検証する設定
 * @returns 型が不正な箇所
 */
function migrationInputErrors(value: JsonObject): string[] {
	const invalid: string[] = [];
	for (const name of LEGACY_ENGINE_NAMES) {
		const section = value[name];
		if (!isObject(section)) {
			continue;
		}
		if (section.enabled !== undefined && typeof section.enabled !== "boolean") {
			invalid.push(`${name}.enabled must be a boolean`);
		}
		if (
			(FINDING_ENGINE_NAMES as readonly string[]).includes(name) &&
			section.rules !== undefined &&
			!isObject(section.rules)
		) {
			invalid.push(`${name}.rules must be an object`);
		}
	}
	return invalid;
}

/**
 * 新旧で意味が変わる指定を列挙する
 *
 * @param value - 調べる設定
 * @returns 新旧を区別できないengineの名前
 */
function ambiguousEngines(value: JsonObject): string[] {
	return LEGACY_ENGINE_NAMES.filter((name) => {
		const section = value[name];
		return (
			isObject(section) &&
			(section.enabled === undefined ||
				(name === "tsdoc-check" &&
					isObject(section.rules) &&
					typeof section.rules.suppression === "string"))
		);
	});
}

/**
 * 旧書式と確認した設定の各sectionを移行する
 *
 * @param value - 旧書式と確認した設定
 * @returns 移行後の設定と手作業の案内
 */
function migrateLegacyConfig(value: JsonObject): MigrationResult {
	const manual: string[] = [];
	const config: JsonObject = {};
	for (const [name, section] of Object.entries(value)) {
		const engine = (FINDING_ENGINE_NAMES as readonly string[]).includes(name);
		if (!LEGACY_ENGINE_NAMES.includes(name)) {
			config[name] = section;
			continue;
		}
		config[name] =
			engine && isObject(section)
				? migrateEngine(name, section, manual)
				: migrateSimpleSection(section);
	}
	return { config, manual };
}

/**
 * 移行前のquality.jsonを新しい書式へ移す
 *
 * @param value - 移行前の設定
 * @param fromV5 - 曖昧な指定もv5の意味で移行するか
 * @returns 移行後の設定と手作業の案内
 */
export function migrateConfig(value: unknown, fromV5 = false): MigrationResult {
	if (!isObject(value)) {
		return { config: {}, manual: ["quality.json must be a JSON object"] };
	}
	const invalid = migrationInputErrors(value);
	if (invalid.length > 0) {
		return { config: value, manual: invalid };
	}
	const currentSections = hasCurrentConfig(value);
	const current = currentSections || "oxlint" in value || "oxfmt" in value;
	const legacy = hasLegacyConfig(value);
	if ((legacy && current && !fromV5) || (fromV5 && currentSections)) {
		return {
			config: value,
			manual: [
				"quality.json mixes current and legacy settings; separate the formats before migrating, then use --from-v5 for the legacy configuration",
			],
		};
	}
	if (!legacy && !fromV5) {
		const ambiguous = current ? [] : ambiguousEngines(value);
		return {
			config: value,
			manual: ambiguous.map(
				(name) =>
					`${name}: cannot distinguish legacy and current settings; use --from-v5 to preserve v5 semantics, or make enabled and the suppression rule/group explicit`,
			),
		};
	}
	return migrateLegacyConfig(value);
}

const USAGE =
	"Usage: quality-check migrate [--config <path>] [--from-v5] [--write]\n  Previews the rewrite of an old quality.json; --write applies it.\n  --from-v5 interprets ambiguous enabled defaults and suppression entries as v5 settings.";

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
	const parsed = parseArgv(argv, {
		flags: ["from-v5", "write"],
		values: ["config"],
	});
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
	const result = migrateConfig(before, parsed.flags.has("from-v5"));
	if (result.manual.length > 0) {
		console.error(
			["Fix these by hand:", ...result.manual.map((line) => `  ${line}`)].join(
				"\n",
			),
		);
		return 1;
	}
	const after = `${JSON.stringify(result.config, null, "\t")}\n`;
	if (JSON.stringify(before) === JSON.stringify(result.config)) {
		console.log(`${path} already uses the current format`);
	} else if (parsed.flags.has("write")) {
		writeFileSync(path, after, "utf8");
		console.log(`Rewrote ${path}`);
	} else {
		console.log(`Preview of ${path} (pass --write to apply):\n${after}`);
	}
	return 0;
}
