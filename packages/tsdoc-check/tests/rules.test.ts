import { describe, expect, test } from "bun:test";
import { promoteFindings } from "../src/rules";
import { scanSource } from "../src/scan";

describe("rule promotion", () => {
	test("raises the selected rule to an error", () => {
		const source = "export const value = 1\n";
		const findings = scanSource(source, "src/sample.ts");
		const promoted = promoteFindings(findings, ["missing-doc"]);
		expect(promoted[0]?.severity).toBe("error");
	});

	test("keeps the other findings as they are", () => {
		const source = "export const value = 1\n";
		const findings = scanSource(source, "src/sample.ts");
		const promoted = promoteFindings(findings, ["tsdoc-tag"]);
		expect(promoted[0]?.severity).toBe("warning");
	});
});
