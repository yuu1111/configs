import { describe, expect, test } from "bun:test";
import {
	copyFileSync,
	cpSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const packageDirectory = resolve(import.meta.dir, "..");
const biomeExecutable = resolve(
	import.meta.dir,
	"../../../../node_modules/.bin",
	process.platform === "win32" ? "biome.exe" : "biome",
);

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonObject(text: string, source: string): JsonObject {
	const value: unknown = JSON.parse(text);
	if (!isJsonObject(value)) {
		throw new Error(`${source} is not a JSON object`);
	}
	return value;
}

function readStringArray(record: JsonObject, key: string): string[] {
	const value = record[key];
	if (
		Array.isArray(value) &&
		value.every((entry) => typeof entry === "string")
	) {
		return value;
	}
	throw new Error(`${key} is not a string array`);
}
function createConsumer(configExport: "biome" | "react", ...presets: string[]) {
	const consumerDirectory = mkdtempSync(
		join(tmpdir(), "biome-config-consumer-"),
	);
	const packageDestination = join(
		consumerDirectory,
		"node_modules",
		"@yuu1111",
		"biome-config",
	);
	const manifest = parseJsonObject(
		readFileSync(join(packageDirectory, "package.json"), "utf8"),
		"package.json",
	);

	writeFileSync(join(consumerDirectory, "package.json"), "{}\n");
	mkdirSync(packageDestination, { recursive: true });
	for (const entry of readStringArray(manifest, "files")) {
		const source = join(packageDirectory, entry);
		const destination = join(packageDestination, entry);
		mkdirSync(join(destination, ".."), { recursive: true });
		cpSync(source, destination, { recursive: true });
	}
	copyFileSync(
		join(packageDirectory, "package.json"),
		join(packageDestination, "package.json"),
	);

	writeFileSync(
		join(consumerDirectory, "biome.json"),
		JSON.stringify({
			extends: [
				`@yuu1111/biome-config/${configExport}`,
				...presets.map((preset) => `@yuu1111/biome-config/${preset}`),
			],
		}),
	);
	writeFileSync(join(consumerDirectory, ".gitignore"), "node_modules/\n");
	const git = Bun.spawnSync(["git", "init", "--quiet", consumerDirectory]);
	expect(git.exitCode, git.stderr.toString()).toBe(0);
	writeFileSync(
		join(consumerDirectory, "sample.json"),
		JSON.stringify({ nested: { value: true }, list: [1, 2] }),
	);

	return consumerDirectory;
}

function runBiome(
	consumerDirectory: string,
	command: string,
	file: string,
	args: string[] = [],
) {
	const result = Bun.spawnSync(
		[biomeExecutable, command, "--max-diagnostics=50", ...args, file],
		{ cwd: consumerDirectory },
	);
	return {
		exitCode: result.exitCode,
		output: `${result.stdout.toString()}\n${result.stderr.toString()}`,
	};
}

function readJson(file: string): JsonObject {
	return parseJsonObject(readFileSync(file, "utf8"), file);
}

describe("published Biome configurations", () => {
	test("published JSON has no nested extends and React contains base settings", () => {
		const base = readJson(join(packageDirectory, "base.json"));
		const react = readJson(join(packageDirectory, "react.json"));

		for (const file of [
			"base.json",
			"react.json",
			"plugins-core.json",
			"plugins-network.json",
			"plugins-discord.json",
		]) {
			expect(readJson(join(packageDirectory, file))).not.toHaveProperty(
				"extends",
			);
		}

		expect(react).toMatchObject(base);
	});

	for (const configExport of ["biome", "react"] as const) {
		test(`${configExport} export formats biome.json and sample.json with expanded JSON`, () => {
			const consumerDirectory = createConsumer(configExport);
			try {
				for (const file of ["biome.json", "sample.json"]) {
					const result = runBiome(consumerDirectory, "format", file, [
						"--write",
					]);
					expect(result.exitCode, result.output).toBe(0);
					const formatted = readFileSync(join(consumerDirectory, file), "utf8");
					expect(formatted).toContain(
						file === "biome.json" ? '"extends": [\n' : '"list": [\n',
					);
				}
			} finally {
				rmSync(consumerDirectory, { recursive: true, force: true });
			}
		});
	}

	for (const configExport of ["biome", "react"] as const) {
		test(`${configExport} export enables the performance diagnostics`, () => {
			const consumerDirectory = createConsumer(configExport);
			try {
				writeFileSync(
					join(consumerDirectory, "index.ts"),
					'export * from "./module";\nexport const value = 1;\n',
				);
				const result = runBiome(consumerDirectory, "lint", "index.ts");
				expect(result.exitCode).not.toBe(0);
				expect(result.output).toContain("lint/performance/noReExportAll");
				expect(result.output).toContain("lint/performance/noBarrelFile");
			} finally {
				rmSync(consumerDirectory, { recursive: true, force: true });
			}
		});
	}

	for (const configExport of ["biome", "react"] as const) {
		test(`${configExport} export warns about nested ternaries`, () => {
			const consumerDirectory = createConsumer(configExport);
			try {
				writeFileSync(
					join(consumerDirectory, "index.ts"),
					'export const pick = (low: boolean, mid: boolean) => (low ? "s" : mid ? "m" : "l")\n',
				);
				const result = runBiome(consumerDirectory, "lint", "index.ts");
				expect(result.output).toContain("lint/style/noNestedTernary");
			} finally {
				rmSync(consumerDirectory, { recursive: true, force: true });
			}
		});
	}

	test("plugin presets load and apply through extends", () => {
		const cases = [
			{
				preset: "plugins/core",
				file: "forwarding.ts",
				source: "const forwarded = 1\nexport default forwarded\n",
				diagnostic: "Re-export is prohibited",
			},
			{
				preset: "plugins/network",
				file: "load.ts",
				source:
					"export async function load(url: string) {\n\treturn fetch(url)\n}\n",
				diagnostic: "Pass an AbortSignal to external fetch calls",
			},
			{
				preset: "plugins/discord",
				file: "update.ts",
				source: "interaction.update(content)\n",
				diagnostic:
					"Wrap dynamic Discord content in a payload that disables mentions",
			},
		] as const;

		for (const { preset, file, source, diagnostic } of cases) {
			const consumerDirectory = createConsumer("biome", preset);
			try {
				writeFileSync(join(consumerDirectory, file), source);
				const result = runBiome(consumerDirectory, "lint", file);
				expect(result.output).toContain(diagnostic);
			} finally {
				rmSync(consumerDirectory, { recursive: true, force: true });
			}
		}
	});

	test("React export enables Tailwind CSS parsing", () => {
		const consumerDirectory = createConsumer("react");
		try {
			writeFileSync(
				join(consumerDirectory, "styles.css"),
				"@theme { --color-brand: #123456; }\n",
			);
			const result = runBiome(consumerDirectory, "format", "styles.css", [
				"--write",
			]);
			expect(result.exitCode, result.output).toBe(0);
			expect(
				readFileSync(join(consumerDirectory, "styles.css"), "utf8"),
			).toContain("\n\t--color-brand");
		} finally {
			rmSync(consumerDirectory, { recursive: true, force: true });
		}
	});
});
