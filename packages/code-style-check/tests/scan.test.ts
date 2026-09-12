import { describe, expect, test } from "bun:test";
import { scanSource } from "../src/scan";

function scan(source: string, file = "sample.ts") {
	return scanSource(source, file);
}

describe("blank lines between function definitions", () => {
	test("reports a missing blank line between adjacent declarations", () => {
		const findings = scan(`function load() {
	return 1
}
function save() {
	return 2
}
`);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			column: 1,
			file: "sample.ts",
			line: 4,
			message:
				"the function definition save needs a single blank line before it",
			rule: "blank-line-between-functions",
			severity: "error",
		});
	});

	test("reports a missing blank line after an export", () => {
		const findings = scan(`async function submitMessage(form: FormData) {
	return commit(form)
}
export function submitRootMessage(form: FormData) {
	return submitMessage(form)
}
`);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.message).toContain("submitRootMessage");
	});

	test("accepts a single blank line", () => {
		const findings = scan(`function load() {
	return 1
}

function save() {
	return 2
}
`);
		expect(findings).toEqual([]);
	});

	test("warns about more than one blank line", () => {
		const findings = scan(`function load() {
	return 1
}


function save() {
	return 2
}
`);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.severity).toBe("warning");
	});

	test("ignores a definition separated by other code", () => {
		const findings = scan(`function load() {
	return 1
}
const value = 2
function save() {
	return value
}
`);
		expect(findings).toEqual([]);
	});

	test("checks nested declarations", () => {
		const findings = scan(`function outer() {
	function inner() {
		return 1
	}
	function innerTwo() {
		return 2
	}
	return inner() + innerTwo()
}
`);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.message).toContain("innerTwo");
	});

	test("treats a comment as transparent", () => {
		expect(
			scan(`function load() {}

// save persists the record
function save() {}
`),
		).toEqual([]);
		expect(
			scan(`function load() {}
// save persists the record
function save() {}
`),
		).toHaveLength(1);
	});
});

describe("definitions excluded from the rule", () => {
	test("ignores adjacent method overload signatures", () => {
		const findings = scan(`function format(value: string): string;
function format(value: number): string;
function format(value: unknown): string {
	return String(value)
}
`);
		expect(findings).toEqual([]);
	});

	test("ignores object methods", () => {
		const findings = scan(`const handlers = {
	load() {},
	save() {},
}
`);
		expect(findings).toEqual([]);
	});

	test("ignores arrow functions assigned to variables", () => {
		const findings = scan(`const load = () => 1
const save = () => 2
`);
		expect(findings).toEqual([]);
	});

	test("ignores a file that cannot be parsed", () => {
		expect(scan("function broken( {")).toEqual([]);
	});
});

describe("class members", () => {
	test("reports a missing blank line between methods", () => {
		const findings = scan(`class Client {
	load() {
		return 1
	}
	save() {
		return 2
	}
}
`);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			line: 5,
			message:
				"the function definition save needs a single blank line before it",
		});
	});

	test("accepts methods separated by a blank line", () => {
		const findings = scan(`class Client {
	load() {
		return 1
	}

	save() {
		return 2
	}
}
`);
		expect(findings).toEqual([]);
	});

	test("parses JSX in a tsx file", () => {
		const findings = scan(
			`export function App() {
	return <div />
}
export function Other() {
	return <span />
}
`,
			"component.tsx",
		);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.message).toContain("Other");
	});
});
