import { afterAll, describe, expect, test } from "bun:test";
import {
	cpSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const fixtureDirectory = mkdtempSync(resolve(tmpdir(), "tsconfig-package-"));
const fixturePackageDirectory = resolve(
	fixtureDirectory,
	"node_modules/@yuu1111/tsconfig",
);
const packageDirectory = resolve(import.meta.dir, "..");
const tscExecutable = resolve(
	import.meta.dir,
	"../../../../node_modules/.bin",
	process.platform === "win32" ? "tsc.exe" : "tsc",
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

const manifest = parseJsonObject(
	readFileSync(resolve(packageDirectory, "package.json"), "utf8"),
	"package.json",
);
for (const fileName of [
	"package.json",
	...readStringArray(manifest, "files"),
]) {
	cpSync(
		resolve(packageDirectory, fileName),
		resolve(fixturePackageDirectory, fileName),
	);
}
writeFileSync(
	resolve(fixtureDirectory, "index.ts"),
	"export const value = 1;\n",
);

afterAll(() => {
	rmSync(fixtureDirectory, { recursive: true, force: true });
});

type Preset = "base" | "bun" | "react" | "library" | "declaration-only";

function showConfig(preset: Preset, overrides: Record<string, unknown> = {}) {
	const configPath = resolve(
		fixtureDirectory,
		`tsconfig-${preset}-${Object.keys(overrides).length}.json`,
	);
	writeFileSync(
		configPath,
		JSON.stringify({
			extends: `@yuu1111/tsconfig/${preset}.json`,
			compilerOptions: overrides,
			include: ["index.ts"],
		}),
	);

	const result = Bun.spawnSync([
		tscExecutable,
		"--showConfig",
		"-p",
		configPath,
	]);
	if (result.exitCode !== 0) {
		throw new Error(
			`tsc --showConfig failed for ${preset}: ${result.stdout.toString()}${result.stderr.toString()}`,
		);
	}
	const config = parseJsonObject(result.stdout.toString(), "tsc --showConfig");
	const compilerOptions = config.compilerOptions;
	if (!isJsonObject(compilerOptions)) {
		throw new Error("compilerOptions is not a JSON object");
	}
	return { compilerOptions };
}

describe("published tsconfig presets", () => {
	test("preserves the complete preset hierarchy through package installation", () => {
		const expectedByPreset: Record<Preset, Record<string, unknown>> = {
			base: {
				strict: true,
				target: "esnext",
				lib: ["esnext"],
				module: "preserve",
				moduleDetection: "force",
				moduleResolution: "bundler",
				noEmit: true,
				isolatedModules: true,
				skipLibCheck: true,
				resolveJsonModule: true,
				forceConsistentCasingInFileNames: true,
				verbatimModuleSyntax: true,
				noUncheckedIndexedAccess: true,
				noFallthroughCasesInSwitch: true,
				exactOptionalPropertyTypes: true,
			},
			bun: {
				strict: true,
				target: "esnext",
				lib: ["esnext"],
				module: "preserve",
				moduleDetection: "force",
				moduleResolution: "bundler",
				noEmit: true,
				types: ["bun"],
			},
			react: {
				strict: true,
				target: "esnext",
				lib: ["esnext", "dom", "dom.iterable"],
				module: "preserve",
				moduleDetection: "force",
				moduleResolution: "bundler",
				noEmit: true,
				jsx: "react-jsx",
			},
			library: {
				strict: true,
				target: "esnext",
				lib: ["esnext"],
				module: "preserve",
				moduleDetection: "force",
				moduleResolution: "bundler",
				noEmit: false,
				declaration: true,
				declarationMap: true,
				sourceMap: true,
			},
			"declaration-only": {
				strict: true,
				target: "esnext",
				lib: ["esnext"],
				module: "preserve",
				moduleDetection: "force",
				moduleResolution: "bundler",
				noEmit: false,
				declaration: true,
				declarationMap: true,
				sourceMap: true,
				emitDeclarationOnly: true,
			},
		};

		for (const [preset, expected] of Object.entries(expectedByPreset) as [
			Preset,
			Record<string, unknown>,
		][]) {
			const { compilerOptions } = showConfig(preset);
			expect(compilerOptions).toMatchObject(expected);
		}
	});

	test("lets the consuming project override inherited compiler options", () => {
		const { compilerOptions } = showConfig("declaration-only", {
			strict: false,
			noEmit: true,
			target: "ES2022",
		});

		expect(compilerOptions.strict).toBe(false);
		expect(compilerOptions.noEmit).toBe(true);
		expect(compilerOptions.emitDeclarationOnly).toBe(true);
		expect(compilerOptions.declaration).toBe(true);
		expect(compilerOptions.target).toBe("es2022");
	});
});
