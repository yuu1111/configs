import { describe, expect, test } from "bun:test";
import { ansiPainter, colorEnabled, plainPainter } from "../src/color";

describe("color detection", () => {
	test("keeps the text as it is for the plain painter", () => {
		expect(plainPainter("done", "pass")).toBe("done");
	});

	test("wraps the text in the ANSI escape of its tone", () => {
		expect(ansiPainter()("done", "pass")).toBe("\u001b[32mdone\u001b[0m");
		expect(ansiPainter()("broken", "error")).toBe("\u001b[31mbroken\u001b[0m");
	});

	test("stays off when a pipe carries the output", () => {
		expect(colorEnabled({ isTTY: undefined }, {})).toBe(false);
	});

	test("follows the terminal when nothing overrides it", () => {
		expect(colorEnabled({ isTTY: true }, {})).toBe(true);
	});

	test("lets NO_COLOR win over the terminal", () => {
		expect(colorEnabled({ isTTY: true }, { NO_COLOR: "1" })).toBe(false);
	});

	test("honors FORCE_COLOR where the terminal cannot report itself", () => {
		expect(colorEnabled({ isTTY: undefined }, { FORCE_COLOR: "1" })).toBe(true);
	});

	test("treats FORCE_COLOR=0 as off", () => {
		expect(colorEnabled({ isTTY: true }, { FORCE_COLOR: "0" })).toBe(false);
	});
});
