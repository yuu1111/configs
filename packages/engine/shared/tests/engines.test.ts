import { describe, expect, test } from "bun:test";
import { applyRuleSeverities } from "../src/engines";

const finding = {
	column: 1,
	file: "src/a.ts",
	line: 1,
	message: "message",
	rule: "sample-rule",
	severity: "error" as const,
};

describe("rule severity", () => {
	test("changes an error to a warning", () => {
		const [actual] = applyRuleSeverities([finding], {
			disable: [],
			enable: [],
			error: [],
			warn: ["sample-rule"],
		});
		expect(actual?.severity).toBe("warning");
	});

	test("changes a warning to an error", () => {
		const [actual] = applyRuleSeverities(
			[{ ...finding, severity: "warning" }],
			{
				disable: [],
				enable: [],
				error: ["sample-rule"],
				warn: [],
			},
		);
		expect(actual?.severity).toBe("error");
	});
});
