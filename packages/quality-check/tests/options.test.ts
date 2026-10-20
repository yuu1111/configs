import { expect, test } from "bun:test";
import { splitEngineSelection } from "../src/options";

test("engine名と対象pathへ分ける", () => {
	expect(splitEngineSelection(["biome", "docs", "knip"])).toEqual({
		engines: ["biome", "knip"],
		targets: ["docs"],
	});
});

test("engine名が無ければ選択しない", () => {
	expect(splitEngineSelection([".", "docs/**"])).toEqual({
		engines: [],
		targets: [".", "docs/**"],
	});
});

test("重複したengine名をまとめる", () => {
	expect(splitEngineSelection(["biome", "biome"])).toEqual({
		engines: ["biome"],
		targets: [],
	});
});
