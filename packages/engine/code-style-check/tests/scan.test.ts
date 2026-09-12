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
			rule: "blank-line-between-definitions",
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

describe("definitions other than functions", () => {
	test("reports a missing blank line between a variable declaration and a type definition", () => {
		const findings = scan(`const responseSchema = 1
type ExportResult = number
`);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			column: 1,
			line: 2,
			message:
				"the type definition ExportResult needs a single blank line before it",
			rule: "blank-line-between-definitions",
			severity: "error",
		});
	});

	test("reports a missing blank line between type definitions", () => {
		const findings = scan(`type First = number
type Second = string
`);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.message).toBe(
			"the type definition Second needs a single blank line before it",
		);
	});

	test("reports a missing blank line between an interface and a variable declaration", () => {
		const findings = scan(`interface Client {
	load(): void
}
const client = 1
`);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			column: 1,
			line: 4,
			message:
				"the variable declaration client needs a single blank line before it",
		});
	});

	test("reports a missing blank line between a function and a variable declaration", () => {
		const findings = scan(`function load() {
	return 1
}
const value = 2
`);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.message).toBe(
			"the variable declaration value needs a single blank line before it",
		);
	});

	test("reports a missing blank line between enum definitions", () => {
		const findings = scan(`enum Color {
	Red
}
enum Size {
	Small
}
`);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.message).toBe(
			"the enum definition Size needs a single blank line before it",
		);
	});

	test("reports a missing blank line between namespace definitions", () => {
		const findings = scan(`namespace First {
	export const value = 1
}
namespace Second {
	export const other = 2
}
`);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			line: 4,
			message:
				"the namespace definition Second needs a single blank line before it",
		});
	});

	test("reports a missing blank line between class definitions", () => {
		const findings = scan(`class Client {}
class Server {}
`);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.message).toBe(
			"the class definition Server needs a single blank line before it",
		);
	});

	test("accepts a blank line before a type definition", () => {
		expect(
			scan(`const responseSchema = 1

type ExportResult = number
`),
		).toEqual([]);
	});
});

describe("pairs that the rule does not require a blank line for", () => {
	test("allows adjacent variable declarations", () => {
		expect(
			scan(`const first = 1
const second = 2
`),
		).toEqual([]);
	});

	test("allows adjacent variable declarations inside a function", () => {
		expect(
			scan(`function load() {
	const first = 1
	const second = 2
	return first + second
}
`),
		).toEqual([]);
	});

	test("breaks adjacency at a statement that is not a definition", () => {
		expect(
			scan(`const first = 1
if (first) {
	consume(first)
}
const second = 2
`),
		).toEqual([]);
	});

	test("breaks adjacency at an import", () => {
		expect(
			scan(`type First = number
import { second } from "./second"
type Second = string
`),
		).toEqual([]);
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

	test("treats arrow functions assigned to variables as variable declarations", () => {
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
			message: "the method definition save needs a single blank line before it",
		});
	});

	test("names a getter and a setter", () => {
		const findings = scan(`class Client {
	get value() {
		return 1
	}
	set value(next: number) {
		consume(next)
	}
}
`);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.message).toBe(
			"the setter definition value needs a single blank line before it",
		);
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
