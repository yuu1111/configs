import { ENGINE_NAMES, type EngineName } from "./config";

/**
 * 位置引数をengine選択と対象pathへ分ける engine名と一致する引数は選択になる
 *
 * @param args - コマンドラインの位置引数の一覧
 * @returns engine選択と対象pathに分けた結果
 */
export function splitEngineSelection(args: readonly string[]): {
	engines: EngineName[];
	targets: string[];
} {
	const engines: EngineName[] = [];
	const targets: string[] = [];
	for (const arg of args) {
		const engine = (ENGINE_NAMES as readonly string[]).includes(arg)
			? (arg as EngineName)
			: undefined;
		if (engine === undefined) {
			targets.push(arg);
			continue;
		}
		if (!engines.includes(engine)) {
			engines.push(engine);
		}
	}
	return { engines, targets };
}

/**
 * 検査する対象pathを決める 上書きを優先し 無ければengineの指定 それも無ければカレントにする
 *
 * @param overrides - コマンドラインから渡された上書き
 * @param configured - engineのsectionが持つ対象path
 * @returns engineへ渡す対象path
 */
export function resolveTargets(
	overrides: string[],
	configured: string[],
): string[] {
	if (overrides.length > 0) {
		return overrides;
	}
	if (configured.length > 0) {
		return configured;
	}
	return ["."];
}
