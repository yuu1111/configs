#!/usr/bin/env bun
import { main } from "./cli/main";

/**
 * CLIの本体を実行し、終了codeでprocessを終える
 *
 * @param main - 引数を受け取って終了codeを返すCLIの本体
 */
function runCli(main: (argv: string[]) => number | Promise<number>): void {
	async function execute(): Promise<void> {
		try {
			process.exit(await main(process.argv.slice(2)));
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exit(2);
		}
	}
	void execute();
}

/**
 * CLIの本体を起動する launcherと直接実行の両方から呼ぶ
 */
export function run(): void {
	runCli(main);
}

if (import.meta.main) {
	run();
}
