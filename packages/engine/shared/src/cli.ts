/**
 * 値を取るoptionと取らないoptionの定義
 */
export interface ArgvSpec {
	/** 値を取らないoptionの名前 --は含めない */
	flags?: readonly string[];
	/** 値を取るoptionの名前 --は含めない */
	values?: readonly string[];
}

/**
 * 解析したoptionと位置引数
 */
export interface Argv {
	flags: ReadonlySet<string>;
	values: ReadonlyMap<string, readonly string[]>;
	targets: string[];
}

function addValue(
	values: Map<string, string[]>,
	name: string,
	value: string,
): void {
	const list = values.get(name);
	if (list === undefined) {
		values.set(name, [value]);
		return;
	}
	list.push(value);
}

function addTarget(targets: string[], argument: string): void {
	if (argument.startsWith("-")) {
		throw new Error(`unknown option: ${argument}`);
	}
	targets.push(argument);
}

function optionName(argument: string): string {
	const separator = argument.indexOf("=");
	return separator === -1 ? argument.slice(2) : argument.slice(2, separator);
}

function inlineValue(argument: string): string | undefined {
	const separator = argument.indexOf("=");
	return separator === -1 ? undefined : argument.slice(separator + 1);
}

function consumeValue(
	values: Map<string, string[]>,
	argv: string[],
	index: number,
	name: string,
): number {
	const value = argv[index + 1];
	if (value === undefined) {
		return 0;
	}
	addValue(values, name, value);
	return 1;
}

/**
 * 引数を解析する 未知のoptionは例外にする
 *
 * @param argv - --付きoptionと位置引数を含む引数の一覧
 * @param spec - 値を取るoptionと取らないoptionの定義
 * @returns 解析したflag、値付きoption、位置引数
 */
export function parseArgv(argv: string[], spec: ArgvSpec): Argv {
	const flags = new Set<string>();
	const values = new Map<string, string[]>();
	const valueNames = new Set(spec.values ?? []);
	const flagNames = new Set(spec.flags ?? []);
	const targets: string[] = [];
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index] ?? "";
		if (!argument.startsWith("--")) {
			addTarget(targets, argument);
			continue;
		}
		const name = optionName(argument);
		if (valueNames.has(name)) {
			const inline = inlineValue(argument);
			if (inline !== undefined) {
				addValue(values, name, inline);
				continue;
			}
			index += consumeValue(values, argv, index, name);
			continue;
		}
		if (flagNames.has(name) && argument.indexOf("=") === -1) {
			flags.add(name);
			continue;
		}
		throw new Error(`unknown option: ${argument}`);
	}
	return { flags, targets, values };
}

/**
 * 引数がhelpを求めているか
 *
 * @param argv - helpの指定を調べる引数の一覧
 * @returns --helpまたは-hを含む場合はtrue
 */
export function wantsHelp(argv: readonly string[]): boolean {
	return argv.includes("--help") || argv.includes("-h");
}

/**
 * CLIの本体を実行し、終了codeでprocessを終える
 *
 * @param main - 引数を受け取って終了codeを返すCLIの本体
 */
export function runCli(
	main: (argv: string[]) => number | Promise<number>,
): void {
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
