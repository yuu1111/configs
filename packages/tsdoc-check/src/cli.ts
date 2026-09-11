#!/usr/bin/env bun
import type { Finding } from "./rules";
import { collectFiles, normalizePath, scanFiles } from "./scan";

interface Options {
	ignores: string[];
	json: boolean;
	targets: string[];
}

function applyFlagOption(options: Options, argument: string): boolean {
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
	const options: Options = { ignores: [], json: false, targets: [] };
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

function describeFinding(finding: Finding): string {
	return `${finding.file}:${finding.line}:${finding.column} ${finding.rule} ${finding.severity} ${finding.message}`;
}

function main(argv: string[]): number {
	if (argv.includes("--help")) {
		console.log("Usage: tsdoc-check [--ignore <path>] [--json] [path...]");
		return 0;
	}
	const options = parseArguments(argv);
	const files = collectFiles(options.targets, process.cwd(), options.ignores);
	const findings = scanFiles(files);
	const errors = findings.filter((finding) => finding.severity === "error");
	const warnings = findings.filter((finding) => finding.severity === "warning");
	if (options.json) {
		console.log(JSON.stringify({ errors, warnings }, null, "\t"));
	} else {
		for (const finding of [...errors, ...warnings]) {
			console.log(describeFinding(finding));
		}
		console.log(
			`Checked ${files.length} files: ${errors.length} errors, ${warnings.length} warnings`,
		);
	}
	return errors.length > 0 ? 1 : 0;
}

try {
	process.exit(main(process.argv.slice(2)));
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(2);
}
