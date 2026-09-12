import { describe, expect, test } from "bun:test";
import { classifyGap, countBlankLines } from "../src/rules";

describe("countBlankLines", () => {
	test("counts the empty lines between two definitions", () => {
		expect(countBlankLines("}\n\nfunction", 1, 3)).toBe(1);
		expect(countBlankLines("}\n\n\nfunction", 1, 4)).toBe(2);
	});

	test("treats a missing blank line as zero", () => {
		expect(countBlankLines("}\nfunction", 1, 2)).toBe(0);
		expect(countBlankLines("} function", 1, 2)).toBe(0);
	});

	test("ignores comment lines", () => {
		expect(countBlankLines("}\n// note\nfunction", 1, 9)).toBe(0);
		expect(countBlankLines("}\n\n// note\nfunction", 1, 10)).toBe(1);
		expect(countBlankLines("} // note\nfunction", 1, 9)).toBe(0);
	});

	test("breaks a run of blank lines at a comment", () => {
		expect(countBlankLines("}\n\n// note\n\nfunction", 1, 12)).toBe(1);
		expect(countBlankLines("}\n\n\n// note\nfunction", 1, 12)).toBe(2);
	});
});

describe("classifyGap", () => {
	test("accepts a single blank line", () => {
		expect(classifyGap(1, "load")).toBeNull();
	});

	test("requires a blank line when it is missing", () => {
		expect(classifyGap(0, "load")).toEqual({
			message:
				"the function definition load needs a single blank line before it",
			severity: "error",
		});
	});

	test("warns about more than one blank line", () => {
		expect(classifyGap(2, "load")).toEqual({
			message:
				"the function definition load has more than one blank line before it",
			severity: "warning",
		});
	});
});
