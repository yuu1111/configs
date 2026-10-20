import type { EngineName } from "../engines/catalog";
import type { RuleSelection } from "../engines/contract";

/**
 * rule1つ分の状態 offで無効 onでengineの既定 warnとerrorで重大度を変更する
 */
export type RuleState = "off" | "on" | "warn" | "error";

/**
 * engineへ渡す起動条件
 */
export interface EngineOptions {
	/**
	 * engineの既定引数の後ろへ足す引数
	 */
	args: string[];
}

/**
 * 型検査へ渡す起動条件
 */
export interface TypecheckOptions extends EngineOptions {
	/**
	 * 型検査するtsconfigのpath
	 */
	projects: string[];
}

/**
 * ruleへの操作 presetは全ruleを一括で設定し stateは指定したruleの状態を変え optionsはruleごとのoptionを重ねる
 */
export type RuleOp =
	| { kind: "preset"; value: "all" | "none" | "recommended" }
	| { kind: "state"; rules: string[]; state: RuleState }
	| { kind: "options"; options: Record<string, string>; rule: string };

/**
 * file globで選んだfileだけへ重ねるrule設定
 */
export interface RuleOverride {
	/**
	 * 対象fileを選ぶ順序付きglob 否定globは先に選んだ対象を除外する
	 */
	files: string[];

	/**
	 * この上書きが重ねるruleへの操作
	 */
	ops: RuleOp[];
}

/**
 * 検出engineへ渡す起動条件 検出engineはin-processで走るため追加の引数は持たない
 */
export interface RuleEngineOptions {
	/**
	 * 検査対象を選ぶglob 否定globは先に選んだ対象を除外する
	 */
	includes: string[];

	/**
	 * 上書きを重ねる前のruleへの操作
	 */
	ops: RuleOp[];

	/**
	 * fileごとにrule設定を重ねる上書き 書いた順に適用する
	 */
	overrides: RuleOverride[];

	/**
	 * 上書きを重ねる前に展開したrule選択
	 */
	rules: RuleSelection;
}

/**
 * engine名ごとの起動条件
 */
export interface EngineConfigMap {
	biome: EngineOptions;
	oxlint: EngineOptions;
	oxfmt: EngineOptions;
	typecheck: TypecheckOptions;
	knip: EngineOptions;
	code: RuleEngineOptions;
	comment: RuleEngineOptions;
	markdown: RuleEngineOptions;
	tsdoc: RuleEngineOptions;
}

/**
 * quality.jsonが表す統合検査の設定
 */
export interface QualityConfig {
	/**
	 * 起動するengine 値がfalseのengineは起動しない
	 */
	engines: Partial<Record<EngineName, boolean>>;

	/**
	 * engineごとの起動条件
	 */
	config: Partial<EngineConfigMap>;

	/**
	 * warningを阻害する検出として扱うか
	 */
	failOnWarnings: boolean;

	/**
	 * baseline fileのpath falseなら差分判定を行わない
	 */
	baseline: string | false;
}
