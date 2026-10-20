/**
 * 旧engine名から現在の検査対象名への対応
 */
export const ENGINE_RENAMES = {
	"code-style-check": "code",
	"comment-check": "comment",
	"document-style-check": "markdown",
	"tsdoc-check": "tsdoc",
} as const;

/**
 * 旧engine名を現在名へ直す 対応表に無い名前はそのまま返す
 *
 * @param name - 設定やbaselineに記録されたengine名
 * @returns 現在のengine名
 */
export function canonicalEngineName(name: string): string {
	return Object.hasOwn(ENGINE_RENAMES, name)
		? ENGINE_RENAMES[name as keyof typeof ENGINE_RENAMES]
		: name;
}
