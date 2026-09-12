import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseConfig } from "../src/config";
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
					"tsdoc-check": { error: ["missing-doc"] },
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

	test("passes the opt-in rules to the period engines", () => {
		const context = createContext();
		context.config = parseConfig(
			{
				config: {
					"comment-check": { enable: ["japanese-period"] },
					"document-style-check": { enable: ["japanese-period"] },
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

	test("repeats the enable flag in config order", () => {
		const context = createContext();
		context.config = parseConfig(
			{
				config: {
					"comment-check": {
						args: ["--extra"],
						enable: ["japanese-period", "second"],
						ignore: ["dist"],
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
			"second",
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
