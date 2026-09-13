import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseConfig, RULE_VOCABULARY } from "../src/config";
import {
	buildEngineCommand,
	buildEngineCommands,
	type EngineCommandContext,
	resolveExecutable,
	skippedEngineOptions,
} from "../src/engines";

const temporaryDirectories: string[] = [];

function createWorkspace(): string {
	const directory = mkdtempSync(join(tmpdir(), "quality-check-test-"));
	temporaryDirectories.push(directory);
	return directory;
}

function createContext(): EngineCommandContext {
	return {
		color: false,
		config: parseConfig(
			{
				config: {
					biome: { ignore: ["src/generated"] },
					"comment-check": { ignore: ["src/generated"] },
					"tsdoc-check": { rules: { "missing-doc": "error" } },
				},
				engines: {
					biome: true,
					"comment-check": true,
					"document-style-check": true,
					knip: true,
					"tsdoc-check": true,
					typecheck: true,
				},
			},
			"test",
		),
		overrides: { ignore: [], targets: ["."] },
		rawBaseline: "raw.json",
	};
}

/**
 * 組み立てたコマンドから指定したflagへ渡された値だけを抜き出す
 *
 * @param command - 調べるコマンドの引数
 * @param flag - 値を抜き出すflag
 * @returns flagへ渡された値の一覧
 */
function flagsOf(command: string[], flag: string): string[] {
	return command.filter((_, index) => command[index - 1] === flag);
}

afterEach(() => {
	for (;;) {
		const directory = temporaryDirectories.pop();
		if (directory === undefined) {
			break;
		}
		rmSync(directory, { force: true, recursive: true });
	}
});

describe("engine commands", () => {
	test("gives Biome the targets without the ignore list", () => {
		expect(buildEngineCommand("biome", "biome", createContext())).toEqual([
			"biome",
			"check",
			".",
		]);
	});

	test("runs the type checker on the project tsconfig", () => {
		expect(buildEngineCommand("typecheck", "tsc", createContext())).toEqual([
			"tsc",
			"--noEmit",
		]);
	});

	test("runs the type checker once per tsconfig", () => {
		const context = createContext();
		context.color = true;
		context.config = parseConfig(
			{
				config: { typecheck: { projects: [".", "examples/client"] } },
				engines: { typecheck: true },
			},
			"test",
		);
		expect(buildEngineCommands("typecheck", "tsc", context)).toEqual([
			["tsc", "--noEmit", "--project", ".", "--pretty"],
			["tsc", "--noEmit", "--project", "examples/client", "--pretty"],
		]);
	});

	test("runs the type checker on the current tsconfig without projects", () => {
		expect(buildEngineCommands("typecheck", "tsc", createContext())).toEqual([
			["tsc", "--noEmit"],
		]);
	});

	test("leaves the Knip arguments to its own configuration", () => {
		expect(buildEngineCommand("knip", "knip", createContext())).toEqual([
			"knip",
		]);
	});

	test("forces the Biome colors when the output supports them", () => {
		const context = createContext();
		context.color = true;
		expect(buildEngineCommand("biome", "biome", context)).toEqual([
			"biome",
			"check",
			"--colors=force",
			".",
		]);
	});

	test("asks the type checker for colored output", () => {
		const context = createContext();
		context.color = true;
		expect(buildEngineCommand("typecheck", "tsc", context)).toEqual([
			"tsc",
			"--noEmit",
			"--pretty",
		]);
	});

	test("keeps a color flag off the engines that print JSON", () => {
		const context = createContext();
		context.color = true;
		expect(
			buildEngineCommand("comment-check", "comment-check", context),
		).toEqual([
			"comment-check",
			"--json",
			"--baseline",
			"raw.json",
			".",
			"--ignore",
			"src/generated",
		]);
	});

	test("disables the comment-check baseline so the runner owns the diff", () => {
		expect(
			buildEngineCommand("comment-check", "comment-check", createContext()),
		).toEqual([
			"comment-check",
			"--json",
			"--baseline",
			"raw.json",
			".",
			"--ignore",
			"src/generated",
		]);
	});

	test("runs the document linter on the targets", () => {
		expect(
			buildEngineCommand(
				"document-style-check",
				"document-style-check",
				createContext(),
			),
		).toEqual(["document-style-check", "lint", "--json", "."]);
	});

	test("runs the source style checker on the targets", () => {
		expect(
			buildEngineCommand(
				"code-style-check",
				"code-style-check",
				createContext(),
			),
		).toEqual(["code-style-check", "--json", "."]);
	});

	test("gives the source style checker the ignore list and the overrides", () => {
		const context = createContext();
		context.overrides = { ignore: ["dist"], targets: ["src"] };
		expect(
			buildEngineCommand("code-style-check", "code-style-check", context),
		).toEqual(["code-style-check", "--json", "src", "--ignore", "dist"]);
	});

	test("passes the selected rules to the period engines", () => {
		const context = createContext();
		context.config = parseConfig(
			{
				config: {
					"comment-check": { rules: { "japanese-period": "on" } },
					"document-style-check": { rules: { "japanese-period": "on" } },
				},
				engines: { "comment-check": true, "document-style-check": true },
			},
			"test",
		);
		expect(
			buildEngineCommand("comment-check", "comment-check", context),
		).toEqual([
			"comment-check",
			"--json",
			"--baseline",
			"raw.json",
			"--enable",
			"japanese-period",
			".",
		]);
		expect(
			buildEngineCommand(
				"document-style-check",
				"document-style-check",
				context,
			),
		).toEqual([
			"document-style-check",
			"lint",
			"--json",
			"--enable",
			"japanese-period",
			".",
		]);
	});

	test("repeats the enable flag in the order of the rules map", () => {
		const context = createContext();
		context.config = parseConfig(
			{
				config: {
					"comment-check": {
						args: ["--extra"],
						ignore: ["dist"],
						rules: { "japanese-period": "on", "cramped-comment": "on" },
					},
				},
				engines: { "comment-check": true },
			},
			"test",
		);
		expect(
			buildEngineCommand("comment-check", "comment-check", context),
		).toEqual([
			"comment-check",
			"--json",
			"--baseline",
			"raw.json",
			"--enable",
			"japanese-period",
			"--enable",
			"cramped-comment",
			".",
			"--ignore",
			"dist",
			"--extra",
		]);
	});

	test("turns the rule names of the TSDoc engine into flags", () => {
		expect(
			buildEngineCommand("tsdoc-check", "tsdoc-check", createContext()),
		).toEqual(["tsdoc-check", "--json", "--error", "missing-doc", "."]);
	});

	test("builds the enable and error flags from the rule states", () => {
		const context = createContext();
		context.config = parseConfig(
			{
				config: {
					"tsdoc-check": {
						rules: { "missing-returns": "error", "param-order": "on" },
					},
				},
				engines: { "tsdoc-check": true },
			},
			"test",
		);
		expect(buildEngineCommand("tsdoc-check", "tsdoc-check", context)).toEqual([
			"tsdoc-check",
			"--json",
			"--enable",
			"missing-returns",
			"--enable",
			"param-order",
			"--error",
			"missing-returns",
			".",
		]);
	});

	test("turns every rule of the TSDoc engine into an error with the error preset", () => {
		const context = createContext();
		context.config = parseConfig(
			{
				config: { "tsdoc-check": { error: true } },
				engines: { "tsdoc-check": true },
			},
			"test",
		);
		const command = buildEngineCommand("tsdoc-check", "tsdoc-check", context);
		const vocabulary = RULE_VOCABULARY["tsdoc-check"];
		expect(flagsOf(command, "--enable")).toEqual([...vocabulary.optIn]);
		expect(flagsOf(command, "--error")).toEqual([...vocabulary.all]);
	});

	test("turns every opt-in rule on and then clears the rules the map turns off", () => {
		const context = createContext();
		context.config = parseConfig(
			{
				config: {
					"comment-check": {
						enable: true,
						rules: { "japanese-period": "off" },
					},
				},
				engines: { "comment-check": true },
			},
			"test",
		);
		const command = buildEngineCommand(
			"comment-check",
			"comment-check",
			context,
		);
		expect(flagsOf(command, "--enable")).toEqual(["cramped-comment"]);
	});

	test("adds the command line overrides to the engines that accept them", () => {
		const context = createContext();
		context.overrides = { ignore: ["dist"], targets: ["src"] };
		expect(buildEngineCommand("biome", "biome", context)).toEqual([
			"biome",
			"check",
			"src",
		]);
		expect(
			buildEngineCommand("comment-check", "comment-check", context),
		).toEqual([
			"comment-check",
			"--json",
			"--baseline",
			"raw.json",
			"src",
			"--ignore",
			"src/generated",
			"--ignore",
			"dist",
		]);
	});
});

describe("engine limits", () => {
	test("reports the conditions that an engine cannot take", () => {
		expect(
			skippedEngineOptions("biome", { ignore: ["src/generated"] }),
		).toEqual(["ignore skipped (biome.json holds its settings)"]);
		expect(skippedEngineOptions("knip", { targets: ["src"] })).toEqual([
			"targets skipped (knip analyzes the whole project)",
		]);
		expect(skippedEngineOptions("typecheck", { targets: ["src"] })).toEqual([
			"targets skipped (tsconfig.json and projects hold its settings)",
		]);
	});

	test("reports nothing for the conditions an engine can take", () => {
		expect(skippedEngineOptions("comment-check", { ignore: ["dist"] })).toEqual(
			[],
		);
		expect(skippedEngineOptions("biome", { targets: ["src"] })).toEqual([]);
		expect(skippedEngineOptions("biome", undefined)).toEqual([]);
	});
});

describe("engine lookup", () => {
	test("finds an engine in node_modules/.bin", () => {
		const cwd = createWorkspace();
		const binDirectory = join(cwd, "node_modules", ".bin");
		mkdirSync(binDirectory, { recursive: true });
		const executable = join(binDirectory, "biome");
		writeFileSync(executable, "");
		expect(resolveExecutable("biome", cwd)).toBe(executable);
	});

	test("searches the parent directories", () => {
		const cwd = createWorkspace();
		const binDirectory = join(cwd, "node_modules", ".bin");
		mkdirSync(binDirectory, { recursive: true });
		const executable = join(binDirectory, "biome");
		writeFileSync(executable, "");
		const nested = join(cwd, "packages", "inner");
		mkdirSync(nested, { recursive: true });
		expect(resolveExecutable("biome", nested)).toBe(executable);
	});
});
