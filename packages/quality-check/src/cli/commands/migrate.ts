import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { findConfigFile } from "../../config/load";
import { migrateConfig } from "../../config/migrate";
import { parseArgv } from "../argv";

const USAGE =
	"Usage: quality-check migrate [--config <path>] [--from-v5] [--write]\n  Previews engine key renames and legacy quality.json conversion; --write applies it.\n  --from-v5 interprets ambiguous enabled defaults and suppression entries as v5 settings.";

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
