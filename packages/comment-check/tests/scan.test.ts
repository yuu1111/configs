import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectFiles } from "@yuu1111/shared/files";
import { SUPPORTED_EXTENSIONS, scanSource } from "../src/scan";

describe("file collection", () => {
	test("skips an ignored path", () => {
		const root = mkdtempSync(join(tmpdir(), "comment-check-"));
		try {
			mkdirSync(join(root, "src", "generated"), { recursive: true });
			writeFileSync(join(root, "src", "a.ts"), "export const a = 1\n");
			writeFileSync(
				join(root, "src", "generated", "b.ts"),
				"// TODO: generated\n",
			);
			const files = collectFiles(["."], {
				cwd: root,
				extensions: SUPPORTED_EXTENSIONS,
				ignores: ["src/generated"],
			});
			expect(
				files.map((file) => file.replace(root, "").split("\\").join("/")),
			).toEqual(["/src/a.ts"]);
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	});
});

describe("source scanning", () => {
	test("reports the position of a finding", () => {
		const findings = scanSource("const a = 1\n// TODO: remove\n", "src/a.ts");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.line).toBe(2);
		expect(findings[0]?.column).toBe(1);
	});
});
