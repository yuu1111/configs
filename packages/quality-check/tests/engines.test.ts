import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseConfig } from "../src/config";
import {
	buildEngineCommand,
	type EngineCommandContext,
	resolveExecutable,
} from "../src/engines";

const temporaryDirectories: string[] = [];

function createWorkspace(): string {
	const directory = mkdtempSync(join(tmpdir(), "quality-check-test-"));
	temporaryDirectories.push(directory);
	return directory;
}

function createContext(): EngineCommandContext {
	return {
		config: parseConfig(
			{
				engines: {
					biome: true,
					"comment-check": true,
					knip: true,
					"tsdoc-check": { args: ["--error", "missing-doc"] },
				},
			},
			"test",
		),
		ignores: ["src/generated"],
		rawBaseline: "raw.json",
		targets: ["."],
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

	test("leaves the Knip arguments to its own configuration", () => {
		expect(buildEngineCommand("knip", "knip", createContext())).toEqual([
			"knip",
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
		).toEqual([
			"document-style-check",
			"lint",
			"--json",
			".",
			"--ignore",
			"src/generated",
		]);
	});

	test("appends the configured arguments after the engine defaults", () => {
		expect(
			buildEngineCommand("tsdoc-check", "tsdoc-check", createContext()),
		).toEqual([
			"tsdoc-check",
			"--json",
			".",
			"--ignore",
			"src/generated",
			"--error",
			"missing-doc",
		]);
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
