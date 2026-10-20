import { ENGINE_NAMES, type EngineName } from "../engines/catalog";
import { canonicalEngineName } from "../engines/legacy-names";

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
		const current =
			arg === "document-style" ? "markdown" : canonicalEngineName(arg);
		if (current !== arg) {
			throw new Error(`${arg} has been renamed to ${current}`);
		}
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
