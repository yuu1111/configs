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
