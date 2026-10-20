import { main as checkMain } from "./commands/check";
import { main as markdownMain } from "./commands/markdown";
import { main as migrateMain } from "./commands/migrate";

/**
 * 個別commandを起動し、通常のengine選択ならundefinedを返す
 *
 * @param argv - CLIの起動引数
 * @param cwd - fileの相対pathを解決するdirectory
 * @returns 個別commandの終了code 通常のengine選択ならundefined
 */
function runSubcommand(argv: string[], cwd: string): number | undefined {
	const [subcommand, ...rest] = argv;
	if (subcommand === "document-style") {
		throw new Error("document-style has been renamed to markdown");
	}
	if (
		subcommand === "markdown" &&
		["scan", "check", "lint", "--help", "-h"].includes(rest[0] ?? "")
	) {
		return markdownMain(rest, cwd);
	}
	if (subcommand === "migrate") {
		return migrateMain(rest, cwd);
	}
	return undefined;
}

/**
 * CLIの本体を起動して終了codeを返す
 *
 * @param argv - 起動時に渡されたcommand line引数
 * @param cwd - configとbaselineを解決する作業ディレクトリ
 * @returns 処理結果を表す終了code
 */
export async function main(
	argv: string[],
	cwd = process.cwd(),
): Promise<number> {
	const subcommand = runSubcommand(argv, cwd);
	if (subcommand !== undefined) {
		return subcommand;
	}
	return checkMain(argv, cwd);
}
