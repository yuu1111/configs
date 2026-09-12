import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isJsonObject } from "@yuu1111/shared/json";

const repositoryRoot = join(import.meta.dir, "..", "..", "..", "..");
const packagesRoot = join(repositoryRoot, "packages");
const packageGroups = ["config", "engine"];

/**
 * packages配下のworkspace packageのディレクトリを返す
 */
function packageDirectories(): string[] {
	return packageGroups.flatMap((group) =>
		readdirSync(join(packagesRoot, group), { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => join(packagesRoot, group, entry.name))
			.filter((directory) => existsSync(join(directory, "package.json"))),
	);
}

/**
 * JSON fileをobjectとして読み取る
 */
function readJsonObject(path: string): Record<string, unknown> {
	const value: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (!isJsonObject(value)) {
		throw new Error(`expected a JSON object: ${path}`);
	}
	return value;
}

/**
 * 末尾のカンマだけを除いたJSONCとしてbun.lockを読み取る
 */
function readLockfile(): Record<string, unknown> {
	const source = readFileSync(join(repositoryRoot, "bun.lock"), "utf8");
	const value: unknown = JSON.parse(source.replace(/,\s*([}\]])/g, "$1"));
	if (!isJsonObject(value)) {
		throw new Error("bun.lock must hold an object");
	}
	return value;
}

/**
 * manifestのbinをコマンド名と実行fileの組にする
 */
function binTargets(name: string, value: unknown): [string, string][] {
	if (typeof value === "string") {
		return [[name, value]];
	}
	if (!isJsonObject(value)) {
		return [];
	}
	return Object.entries(value).filter(
		(entry): entry is [string, string] => typeof entry[1] === "string",
	);
}

/**
 * filesの宣言を配布対象のpath一覧にする
 */
function filePatterns(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}
	return value.filter((entry): entry is string => typeof entry === "string");
}

/**
 * 先頭の ./ を落とした相対pathを返す
 */
function normalize(path: string): string {
	return path.startsWith("./") ? path.slice(2) : path;
}

/**
 * filesの宣言が実行fileを配布対象へ含めるか判定する
 */
function coversFile(files: readonly string[], target: string): boolean {
	const normalized = normalize(target);
	return files.some((entry) => {
		const pattern = normalize(entry).replace(/\/$/, "");
		return normalized === pattern || normalized.startsWith(`${pattern}/`);
	});
}

/**
 * workspace packageのディレクトリをbun.lockのworkspaces keyへ変換する
 */
function workspaceKey(directory: string): string {
	return directory.slice(repositoryRoot.length + 1).replaceAll("\\", "/");
}

describe("workspace bin contracts", () => {
	test("points every bin at a file that exists before the build", () => {
		for (const directory of packageDirectories()) {
			const manifest = readJsonObject(join(directory, "package.json"));
			const name =
				typeof manifest.name === "string" ? manifest.name : directory;
			for (const [, target] of binTargets(name, manifest.bin)) {
				const where = `${name} bin -> ${target}`;
				expect(existsSync(join(directory, target)), where).toBe(true);
				expect(normalize(target).startsWith("dist/"), where).toBe(false);
				const launcher = readFileSync(join(directory, target), "utf8");
				expect(launcher.startsWith("#!"), where).toBe(true);
			}
		}
	});

	test("lists every bin target in the published files", () => {
		for (const directory of packageDirectories()) {
			const manifest = readJsonObject(join(directory, "package.json"));
			const files = filePatterns(manifest.files);
			if (files === undefined) {
				continue;
			}
			const name =
				typeof manifest.name === "string" ? manifest.name : directory;
			for (const [, target] of binTargets(name, manifest.bin)) {
				expect(coversFile(files, target), `${name} bin -> ${target}`).toBe(
					true,
				);
			}
		}
	});

	test("records the same bin in bun.lock for a frozen install", () => {
		const workspaces = readLockfile().workspaces;
		if (!isJsonObject(workspaces)) {
			throw new Error("bun.lock must hold a workspaces object");
		}
		for (const directory of packageDirectories()) {
			const manifest = readJsonObject(join(directory, "package.json"));
			const name =
				typeof manifest.name === "string" ? manifest.name : directory;
			const targets = binTargets(name, manifest.bin);
			if (targets.length === 0) {
				continue;
			}
			const record = workspaces[workspaceKey(directory)];
			const recorded = isJsonObject(record) ? binTargets(name, record.bin) : [];
			expect(Object.fromEntries(recorded), `${name} in bun.lock`).toEqual(
				Object.fromEntries(targets),
			);
		}
	});
});
