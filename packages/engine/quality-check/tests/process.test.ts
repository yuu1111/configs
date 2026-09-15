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
} from "../src/process";

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
				biome: { enabled: true },
				knip: { enabled: true },
				typecheck: { enabled: true },
			},
			"test",
		),
		overrides: { ignore: [], targets: [] },
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

describe("process engine commands", () => {
	test("gives Biome the targets without the ignore list", () => {
		const context = createContext();
		context.overrides = { ignore: ["dist"], targets: ["."] };
		expect(buildEngineCommand("biome", "biome", context)).toEqual([
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
				typecheck: { enabled: true, projects: [".", "examples/client"] },
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

	test("appends the configured arguments to a process engine", () => {
		const context = createContext();
		context.config = parseConfig(
			{
				biome: { args: ["--diagnostic-level=error"], enabled: true },
			},
			"test",
		);
		expect(buildEngineCommand("biome", "biome", context)).toEqual([
			"biome",
			"check",
			".",
			"--diagnostic-level=error",
		]);
	});

	test("applies failOnWarnings to Biome", () => {
		const context = createContext();
		context.config = parseConfig(
			{
				biome: { enabled: true },
				failOnWarnings: true,
			},
			"test",
		);
		expect(buildEngineCommand("biome", "biome", context)).toEqual([
			"biome",
			"check",
			".",
			"--error-on-warnings",
		]);
	});

	test("does not repeat an explicit Biome warning argument", () => {
		const context = createContext();
		context.config = parseConfig(
			{
				biome: { args: ["--error-on-warnings"], enabled: true },
				failOnWarnings: true,
			},
			"test",
		);
		expect(buildEngineCommand("biome", "biome", context)).toEqual([
			"biome",
			"check",
			".",
			"--error-on-warnings",
		]);
	});

	test("adds the command line overrides to the engines that accept them", () => {
		const context = createContext();
		context.overrides = { ignore: ["dist"], targets: ["src"] };
		expect(buildEngineCommand("biome", "biome", context)).toEqual([
			"biome",
			"check",
			"src",
		]);
	});
});

describe("engine limits", () => {
	test("reports the conditions that an engine cannot take", () => {
		expect(
			skippedEngineOptions("biome", { ignore: ["src/generated"], targets: [] }),
		).toEqual(["ignore skipped (biome.json holds its settings)"]);
		expect(
			skippedEngineOptions("knip", { ignore: [], targets: ["src"] }),
		).toEqual(["targets skipped (knip analyzes the whole project)"]);
		expect(
			skippedEngineOptions("typecheck", { ignore: [], targets: ["src"] }),
		).toEqual([
			"targets skipped (tsconfig.json and projects hold its settings)",
		]);
	});

	test("reports nothing for the conditions an engine can take", () => {
		expect(
			skippedEngineOptions("biome", { ignore: [], targets: ["src"] }),
		).toEqual([]);
		expect(skippedEngineOptions("biome", { ignore: [], targets: [] })).toEqual(
			[],
		);
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
