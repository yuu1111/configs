import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const temporaryDirectory = mkdtempSync(resolve(tmpdir(), "biome-config-"));
const biomeExecutable = resolve(
	import.meta.dir,
	"../../../node_modules/.bin",
	process.platform === "win32" ? "biome.exe" : "biome",
);
afterAll(() => {
	rmSync(temporaryDirectory, { recursive: true });
});

function lint(source: string, fixtureName: string, configName = "core.json") {
	const fixturePath = resolve(temporaryDirectory, `${fixtureName}.ts`);
	writeFileSync(fixturePath, source);

	const result = Bun.spawnSync([
		biomeExecutable,
		"lint",
		"--config-path",
		resolve(import.meta.dir, configName),
		"--max-diagnostics=50",
		fixturePath,
	]);

	return `${result.stdout.toString()}\n${result.stderr.toString()}`;
}

describe("core custom rules", () => {
	test("incomplete implementations and silent fallbacks", () => {
		const invalid = lint(
			`async function load() {
	throw new Error("Not implemented")
}

request.catch(() => null)
try {
	await loadRemote()
} catch (error) {
	console.error("Load failed", error)
}
`,
			"incomplete-invalid",
		);
		const valid = lint(
			`async function load() {
	throw new Error("The response body is missing")
}

request.catch(reportError)
// biome-ignore lint/plugin: An optional cache miss is an expected fallback
cacheRequest.catch(() => null)
`,
			"incomplete-valid",
		);

		expect(invalid).toContain(
			"Do not leave incomplete implementations or silently replace failures",
		);
		expect(
			invalid.match(
				/Do not leave incomplete implementations or silently replace failures/g,
			),
		).toHaveLength(3);
		expect(valid).not.toContain(
			"Do not leave incomplete implementations or silently replace failures",
		);
	});

	test("type-safety bypasses", () => {
		const invalid = lint(
			`const data = value as unknown as User
const record = value as Record<string, unknown>
const parsed = JSON.parse(text) as User
const property = Reflect.get(object, "name")
const result = Reflect.apply(callback, undefined, [value])
`,
			"type-safety-invalid",
		);
		const valid = lint(
			`const parsed: unknown = JSON.parse(text)
const data = UserSchema.parse(parsed)
const property = object.name
`,
			"type-safety-valid",
		);

		expect(invalid).toContain(
			"Do not bypass type safety with a chained assertion",
		);
		expect(invalid).toContain("Validate parsed JSON before asserting its type");
		expect(invalid).toContain(
			"Validate the object shape instead of asserting a generic dictionary",
		);
		expect(invalid).toContain(
			"Use direct property access when the property name is static",
		);
		expect(invalid).toContain(
			"Call the function directly when no receiver is required",
		);
		expect(valid).not.toContain("type safety");
		expect(valid).not.toContain("Validate parsed JSON");
	});

	test("unsafe errno assertions", () => {
		const invalid = lint(
			`const first = (error as NodeJS.ErrnoException).code
const second = (error as NodeJS.ErrnoException)["code"]
`,
			"errno-invalid",
		);
		const valid = lint(
			`function hasErrorCode(error: unknown, code: string): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === code
}

const optionalCode = (error as NodeJS.ErrnoException | null)?.code
`,
			"errno-valid",
		);

		expect(invalid).toContain(
			"Validate the error shape before reading errno properties",
		);
		expect(
			invalid.match(
				/Validate the error shape before reading errno properties/g,
			),
		).toHaveLength(2);
		expect(valid).not.toContain(
			"Validate the error shape before reading errno properties",
		);
	});

	test("empty and tautological tests", () => {
		const invalid = lint(
			`test("empty", () => {}, 1000)
expect(result).toEqual(result)
expect(true).toBe(true)
`,
			"meaningless-test-invalid",
		);
		const valid = lint(
			`test("returns the result", () => {
	expect(result).toEqual(expected)
})
`,
			"meaningless-test-valid",
		);

		expect(invalid).toContain("Remove empty or tautological tests");
		expect(valid).not.toContain("Remove empty or tautological tests");
	});

	test("pass-through wrappers", () => {
		const invalid = lint(
			`const load = (id) => fetchUser(id)
const loadAsync = async (id) => await fetchUser(id)
`,
			"abstraction-invalid",
		);
		const valid = lint(
			`const load = (id) => {
	assertValidId(id)
	return fetchUser(id)
}
`,
			"abstraction-valid",
		);

		expect(invalid).toContain(
			"Remove pass-through wrappers that add no behavior",
		);
		expect(
			invalid.match(/Remove pass-through wrappers that add no behavior/g),
		).toHaveLength(2);
		expect(valid).not.toContain(
			"Remove pass-through wrappers that add no behavior",
		);
	});
});

describe("network custom rules", () => {
	test("AbortController timeout cleanup", () => {
		const invalid = lint(
			`async function load(url: string, timeoutMs: number) {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), timeoutMs)
	return fetch(url, { signal: controller.signal })
}

const loadArrow = async (url: string, timeoutMs: number) => {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), timeoutMs)
	return fetch(url, { signal: controller.signal })
}
`,
			"abort-timeout-invalid",
			"network.json",
		);
		const valid = lint(
			`async function load(url: string, timeoutMs: number) {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), timeoutMs)
	try {
		return await fetch(url, { signal: controller.signal })
	} finally {
		clearTimeout(timeout)
	}
}

async function loadWithNativeTimeout(url: string, timeoutMs: number) {
	return fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
}
`,
			"abort-timeout-valid",
			"network.json",
		);

		expect(invalid).toContain(
			"Clear the AbortController timeout after using its signal",
		);
		expect(
			invalid.match(
				/Clear the AbortController timeout after using its signal/g,
			),
		).toHaveLength(2);
		expect(valid).not.toContain(
			"Clear the AbortController timeout after using its signal",
		);
	});
});

describe("Discord custom rules", () => {
	test("dynamic interaction updates without matching crypto hash updates", () => {
		const invalid = lint(
			`interaction.update(content)
interaction.update({ content })
`,
			"discord-message-invalid",
			"discord.json",
		);
		const valid = lint(
			`interaction.update({ content, allowedMentions: { parse: [] } })
createHash("sha256").update(content)
crypto.createHash("sha256").update(content)
`,
			"discord-message-valid",
			"discord.json",
		);

		expect(
			invalid.match(
				/(?:Wrap dynamic Discord content|Set allowedMentions when sending dynamic Discord content)/g,
			),
		).toHaveLength(2);
		expect(valid).not.toContain("dynamic Discord content");
	});
});

describe("preset hierarchy", () => {
	test("child presets repeat every parent plugin", async () => {
		const testConfig = await Bun.file(
			resolve(import.meta.dir, "core.json"),
		).json();
		const core = await Bun.file(
			resolve(import.meta.dir, "../plugins-core.json"),
		).json();
		const network = await Bun.file(
			resolve(import.meta.dir, "../plugins-network.json"),
		).json();
		const discord = await Bun.file(
			resolve(import.meta.dir, "../plugins-discord.json"),
		).json();

		const pluginNames = (plugins: string[]) =>
			plugins.map((plugin) => plugin.split("/").at(-1));

		expect(pluginNames(core.plugins)).toEqual(pluginNames(testConfig.plugins));
		expect(network.plugins).toEqual(expect.arrayContaining(core.plugins));
		expect(discord.plugins).toEqual(expect.arrayContaining(network.plugins));
		expect(new Set(core.plugins).size).toBe(core.plugins.length);
		expect(new Set(network.plugins).size).toBe(network.plugins.length);
		expect(new Set(discord.plugins).size).toBe(discord.plugins.length);
	});
});
