import { expect, test } from "bun:test";
import { splitEngineSelection } from "../../src/cli/selection";

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

test.each([
	["code-style-check", "code"],
	["comment-check", "comment"],
	["document-style-check", "markdown"],
	["tsdoc-check", "tsdoc"],
	["document-style", "markdown"],
])(
	"旧engine名を対象pathとして扱わず改名先を案内する: %s",
	(oldName, currentName) => {
		expect(() => splitEngineSelection([oldName])).toThrow(
			`renamed to ${currentName}`,
		);
	},
);
