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
	"../../../node_modules/.bin",
	process.platform === "win32" ? "biome.exe" : "biome",
);

type JsonObject = Record<string, unknown>;

function createConsumer(configExport: "biome" | "react") {
	const consumerDirectory = mkdtempSync(
		join(tmpdir(), "biome-config-consumer-"),
	);
	const packageDestination = join(
		consumerDirectory,
		"node_modules",
		"@yuu1111",
		"biome-config",
	);
	const manifest = JSON.parse(
		readFileSync(join(packageDirectory, "package.json"), "utf8"),
	) as { files: string[] };

	writeFileSync(join(consumerDirectory, "package.json"), "{}\n");
	mkdirSync(packageDestination, { recursive: true });
	for (const entry of manifest.files) {
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
		JSON.stringify({ extends: [`@yuu1111/biome-config/${configExport}`] }),
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

function readJson(file: string) {
	return JSON.parse(readFileSync(file, "utf8")) as JsonObject;
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
