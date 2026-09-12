type JsonObject = Record<string, unknown>;

/**
 * 配列でないobjectか判定する
 */
export function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
