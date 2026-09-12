type JsonObject = Record<string, unknown>;

/**
 * 配列でないobjectか判定する
 *
 * @param value - 配列でないobjectか判定する対象の値
 * @returns objectであり配列でない場合はtrue
 */
export function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
