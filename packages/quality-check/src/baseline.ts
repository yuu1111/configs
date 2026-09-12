import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { NormalizedFinding } from "./findings";

/**
 * baselineへ記録する検出1件の識別情報と件数
 */
export interface BaselineEntry {
	count: number;
	engine: string;
	file: string;
	rule: string;
	text: string;
}

/**
 * baseline fileの形式
 */
export interface BaselineFile {
	entries: BaselineEntry[];
	version: 1;
}

/**
 * baselineと現在の検出を比較した結果
 */
export interface BaselineComparison {
	added: NormalizedFinding[];
	resolved: BaselineEntry[];
}

type JsonObject = Record<string, unknown>;

/**
 * 検出をbaseline上で一意に識別するkeyに使う項目
 */
export interface BaselineKey {
	engine: string;
	file: string;
	rule: string;
	text: string;
}

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBaselineEntry(value: unknown): value is BaselineEntry {
	if (!isJsonObject(value)) {
		return false;
	}
	return (
		typeof value.engine === "string" &&
		typeof value.rule === "string" &&
		typeof value.file === "string" &&
		typeof value.text === "string" &&
		typeof value.count === "number"
	);
}

function entryKey(entry: BaselineKey): string {
	return [entry.engine, entry.rule, entry.file, entry.text].join("\u0000");
}

function compareEntries(left: BaselineEntry, right: BaselineEntry): number {
	const leftKey = entryKey(left);
	const rightKey = entryKey(right);
	if (leftKey === rightKey) {
		return 0;
	}
	return leftKey < rightKey ? -1 : 1;
}

/**
 * 検出をengineとruleとfileと本文で集計してbaselineを作る
 */
export function createBaseline(findings: NormalizedFinding[]): BaselineFile {
	const entries = new Map<string, BaselineEntry>();
	for (const finding of findings) {
		const key = entryKey(finding);
		const existing = entries.get(key);
		if (existing) {
			existing.count += 1;
			continue;
		}
		entries.set(key, {
			count: 1,
			engine: finding.engine,
			file: finding.file,
			rule: finding.rule,
			text: finding.text,
		});
	}
	return { entries: [...entries.values()].sort(compareEntries), version: 1 };
}

/**
 * 現在の検出からbaseline済みを除き、解消済みentryを求める
 */
export function compareWithBaseline(
	findings: NormalizedFinding[],
	baseline: BaselineFile,
): BaselineComparison {
	const remaining = new Map<string, number>();
	for (const entry of baseline.entries) {
		const key = entryKey(entry);
		remaining.set(key, (remaining.get(key) ?? 0) + entry.count);
	}
	const added: NormalizedFinding[] = [];
	for (const finding of findings) {
		const key = entryKey(finding);
		const count = remaining.get(key) ?? 0;
		if (count > 0) {
			remaining.set(key, count - 1);
			continue;
		}
		added.push(finding);
	}
	const resolved = baseline.entries.filter(
		(entry) => (remaining.get(entryKey(entry)) ?? 0) > 0,
	);
	return { added, resolved };
}

/**
 * baseline fileを読み込む 存在しない場合は空のbaselineを返す
 */
export function readBaseline(path: string): BaselineFile {
	if (!existsSync(path)) {
		return { entries: [], version: 1 };
	}
	const value: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (
		!isJsonObject(value) ||
		!Array.isArray(value.entries) ||
		!value.entries.every(isBaselineEntry)
	) {
		throw new Error(`${path} is not a quality baseline`);
	}
	return { entries: value.entries, version: 1 };
}

/**
 * baseline fileをタブ区切りのJSONで書き込む
 */
export function writeBaseline(path: string, baseline: BaselineFile): void {
	writeFileSync(path, `${JSON.stringify(baseline, null, "\t")}\n`);
}
