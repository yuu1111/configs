/**
 * 出力行へ割り当てる装飾の種類
 */
export type Tone = "error" | "header" | "muted" | "pass" | "warn";

/**
 * toneに応じて文字列を装飾する関数
 */
export type Painter = (text: string, tone: Tone) => string;

const ANSI_CODES: Record<Tone, string> = {
	error: "31",
	header: "36",
	muted: "2",
	pass: "32",
	warn: "33",
};

/**
 * 装飾を付けずにそのまま返すpainter
 *
 * @param text - 装飾せずにそのまま返す文字列
 * @param _tone - 割り当てる装飾の種類 このpainterでは使わない
 * @returns 装飾を付けないtextそのもの
 */
export function plainPainter(text: string, _tone: Tone): string {
	return text;
}

/**
 * ANSI escapeでtoneを色へ割り当てるpainterを作る
 *
 * @returns toneに対応するANSI escapeでtextを包むpainter
 */
export function ansiPainter(): Painter {
	return (text, tone) => `\u001b[${ANSI_CODES[tone]}m${text}\u001b[0m`;
}

/**
 * 出力先と環境変数から装飾の可否を決める
 *
 * @param stream - isTTYで出力先が端末かを示すstream
 * @param env - NO_COLORとFORCE_COLORを参照する環境変数
 * @returns 装飾を有効にする場合はtrue
 */
export function colorEnabled(
	stream: { isTTY?: boolean | undefined },
	env: Record<string, string | undefined>,
): boolean {
	if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") {
		return false;
	}
	if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "") {
		return env.FORCE_COLOR !== "0";
	}
	return stream.isTTY === true;
}
