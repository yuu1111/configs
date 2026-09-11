#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
	type BaselineEntry,
	type BaselineFile,
	compareWithBaseline,
	createBaseline,
} from "./baseline";
import type { Finding } from "./rules";
import { collectFiles, normalizePath, scanFiles } from "./scan";

const DEFAULT_BASELINE = "comment-baseline.json";

const RULE_MESSAGES: Record<string, string> = {
	"broad-suppression": "file-wide suppression hides too much",
	"placeholder-comment": "placeholder comment should be resolved or tracked",
	"separator-comment": "decorative separator comment adds no information",
	"undocumented-directive": "TypeScript directive needs a description",
};

interface Options {
	baselinePath: string;
	ignores: string[];
	json: boolean;
	targets: string[];
	update: boolean;
}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBaselineEntry(value: unknown): value is BaselineEntry {
	if (!isJsonObject(value)) {
		return false;
	}
	return (
		typeof value.rule === "string" &&
		typeof value.file === "string" &&
		typeof value.text === "string" &&
		typeof value.count === "number"
	);
}

function applyFlagOption(options: Options, argument: string): boolean {
	if (argument === "--update-baseline") {
		options.update = true;
		return true;
	}
	if (argument === "--json") {
		options.json = true;
		return true;
	}
	return false;
}

function applyValueOption(
	options: Options,
	argument: string,
	argv: string[],
	index: number,
): number | null {
	if (argument === "--baseline") {
		options.baselinePath = argv[index + 1] ?? DEFAULT_BASELINE;
		return 1;
	}
	if (argument.startsWith("--baseline=")) {
		options.baselinePath = argument.slice("--baseline=".length);
		return 0;
	}
	if (argument === "--ignore") {
		const value = argv[index + 1];
		if (value !== undefined) {
			options.ignores.push(normalizePath(value));
		}
		return 1;
	}
	if (argument.startsWith("--ignore=")) {
		options.ignores.push(normalizePath(argument.slice("--ignore=".length)));
		return 0;
	}
	return null;
}

function parseArguments(argv: string[]): Options {
	const options: Options = {
		baselinePath: DEFAULT_BASELINE,
		ignores: [],
		json: false,
		targets: [],
		update: false,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index] ?? "";
		const consumed = applyValueOption(options, argument, argv, index);
		if (consumed !== null) {
			index += consumed;
			continue;
		}
		if (applyFlagOption(options, argument)) {
			continue;
		}
		if (argument.startsWith("-")) {
			throw new Error(`unknown option: ${argument}`);
		}
		options.targets.push(argument);
	}
	if (options.targets.length === 0) {
		options.targets.push(".");
	}
	return options;
}

function readBaseline(path: string): BaselineFile {
	if (!existsSync(path)) {
		return { entries: [], version: 1 };
	}
	const value: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (
		!isJsonObject(value) ||
		!Array.isArray(value.entries) ||
		!value.entries.every(isBaselineEntry)
	) {
		throw new Error(`${path} is not a comment baseline`);
	}
	return { entries: value.entries, version: 1 };
}

function describeFinding(finding: Finding): string {
	return `${finding.file}:${finding.line}:${finding.column} ${finding.rule} ${RULE_MESSAGES[finding.rule] ?? ""}`.trimEnd();
}

function main(argv: string[]): number {
	if (argv.includes("--help")) {
		console.log(
			"Usage: comment-check [--baseline <path>] [--ignore <path>] [--update-baseline] [--json] [path...]",
		);
		return 0;
	}
	const options = parseArguments(argv);
	const files = collectFiles(options.targets, process.cwd(), options.ignores);
	const findings = scanFiles(files);

	if (options.update) {
		const baseline = createBaseline(findings);
		writeFileSync(
			options.baselinePath,
			`${JSON.stringify(baseline, null, "\t")}\n`,
		);
		console.log(
			`Recorded ${baseline.entries.length} entries in ${options.baselinePath}`,
		);
		return 0;
	}

	const baseline = readBaseline(options.baselinePath);
	const comparison = compareWithBaseline(findings, baseline);
	if (options.json) {
		console.log(
			JSON.stringify(
				{ added: comparison.added, resolved: comparison.resolved },
				null,
				"\t",
			),
		);
	} else {
		for (const finding of comparison.added) {
			console.log(describeFinding(finding));
		}
		console.log(
			`Checked ${files.length} files: ${comparison.added.length} new, ${comparison.resolved.length} resolved, ${baseline.entries.length} baselined`,
		);
	}
	return comparison.added.length > 0 ? 1 : 0;
}

try {
	process.exit(main(process.argv.slice(2)));
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(2);
}
