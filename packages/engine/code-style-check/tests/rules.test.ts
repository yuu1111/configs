import { describe, expect, test } from "bun:test";
import {
	classifyGap,
	countBlankLines,
	describeDefinition,
	requiresBlankLine,
	ruleFor,
} from "../src/rules";

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

describe("requiresBlankLine", () => {
	test("requires a blank line between definitions of the same kind", () => {
		expect(requiresBlankLine("function", "function")).toBe(true);
		expect(requiresBlankLine("type", "type")).toBe(true);
		expect(requiresBlankLine("method", "method")).toBe(true);
	});

	test("requires a blank line between definitions of different kinds", () => {
		expect(requiresBlankLine("variable", "type")).toBe(true);
		expect(requiresBlankLine("interface", "variable")).toBe(true);
		expect(requiresBlankLine("function", "variable")).toBe(true);
	});

	test("allows adjacent variable declarations", () => {
		expect(requiresBlankLine("variable", "variable")).toBe(false);
	});

	test("allows adjacent class properties", () => {
		expect(requiresBlankLine("property", "property")).toBe(false);
	});

	test("requires a blank line between a property and a method", () => {
		expect(requiresBlankLine("property", "method")).toBe(true);
		expect(requiresBlankLine("method", "property")).toBe(true);
	});
});

describe("describeDefinition", () => {
	test("combines the kind and the name", () => {
		expect(describeDefinition("type", "ExportResult")).toBe(
			"type definition ExportResult",
		);
		expect(describeDefinition("variable", "value")).toBe(
			"variable declaration value",
		);
		expect(describeDefinition("property", "baseUrl")).toBe(
			"property declaration baseUrl",
		);
	});

	test("names a constructor without repeating the name", () => {
		expect(describeDefinition("constructor", "constructor")).toBe(
			"constructor",
		);
	});
});

describe("ruleFor", () => {
	test("uses the class member rule when a property is involved", () => {
		expect(ruleFor("property", "method")).toBe(
			"blank-line-between-class-members",
		);
		expect(ruleFor("method", "property")).toBe(
			"blank-line-between-class-members",
		);
	});

	test("uses the definition rule otherwise", () => {
		expect(ruleFor("method", "method")).toBe("blank-line-between-definitions");
		expect(ruleFor("variable", "type")).toBe("blank-line-between-definitions");
	});
});

describe("classifyGap", () => {
	test("accepts a single blank line", () => {
		expect(classifyGap(1, "function", "load")).toBeNull();
	});

	test("requires a blank line when it is missing", () => {
		expect(classifyGap(0, "function", "load")).toEqual({
			message:
				"the function definition load needs a single blank line before it",
			severity: "error",
		});
	});

	test("names the kind of the following definition", () => {
		expect(classifyGap(0, "type", "ExportResult")).toEqual({
			message:
				"the type definition ExportResult needs a single blank line before it",
			severity: "error",
		});
	});

	test("warns about more than one blank line", () => {
		expect(classifyGap(2, "function", "load")).toEqual({
			message:
				"the function definition load has more than one blank line before it",
			severity: "warning",
		});
	});
});
