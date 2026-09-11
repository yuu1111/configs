import { describe, expect, test } from "bun:test";
import { extractComments } from "../src/comments";

const open = "$" + "{";

describe("comment extraction", () => {
	test("collects line and block comments", () => {
		const comments = extractComments(
			"// first\nconst value = 1\n/* second */\n",
		);
		expect(comments.map((comment) => comment.text)).toEqual([
			" first",
			" second ",
		]);
		expect(comments.map((comment) => comment.kind)).toEqual(["line", "block"]);
	});

	test("ignores comment markers inside strings and templates", () => {
		const source =
			'const url = "https://example.com"\nconst label = `a // b`\nconst value = 1 // real\n';
		expect(extractComments(source).map((comment) => comment.text)).toEqual([
			" real",
		]);
	});

	test("reads comments inside template expressions", () => {
		const source = `const label = \`a ${open}value /* inner */}\`\n`;
		expect(extractComments(source).map((comment) => comment.text)).toEqual([
			" inner ",
		]);
	});

	test("ignores comment markers inside regex literals", () => {
		const source = "const pattern = /[/*]/\nconst value = 1 // real\n";
		expect(extractComments(source).map((comment) => comment.text)).toEqual([
			" real",
		]);
	});

	test("walks nested templates", () => {
		const source = `const label = \`a ${open}other ? \`b ${open}value}\` : "c"}\` // real\n`;
		expect(extractComments(source).map((comment) => comment.text)).toEqual([
			" real",
		]);
	});
});
