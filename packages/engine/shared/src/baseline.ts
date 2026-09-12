import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isJsonObject } from "./json";

/**
 * baselineへ記録する検出1件の識別情報と件数
 */
export interface BaselineEntry {
	count: number;
	/** 検出元のengine 単一engineのbaselineでは省略する */
	engine?: string;
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
 *
 * @typeParam TFinding - baselineのkeyとして扱える検出の型
 */
export interface BaselineComparison<TFinding> {
	added: TFinding[];
	resolved: BaselineEntry[];
}

/**
 * 検出をbaseline上で一意に識別する項目
 */
export interface BaselineKey {
	engine?: string;
	file: string;
	rule: string;
	text: string;
}

/**
 * entryをbaseline上で一意に識別するkeyを返す
 *
 * @param entry - keyへ変換するbaselineのentry
 * @returns engine、rule、file、textをNUL文字で連結した識別key
 */
export function entryKey(entry: BaselineKey): string {
	return [entry.engine ?? "", entry.rule, entry.file, entry.text].join(
		"\u0000",
	);
}

function compareEntries(left: BaselineEntry, right: BaselineEntry): number {
	const leftKey = entryKey(left);
	const rightKey = entryKey(right);
	if (leftKey === rightKey) {
		return 0;
	}
	return leftKey < rightKey ? -1 : 1;
}

function toEntry(finding: BaselineKey): BaselineEntry {
	const entry: BaselineEntry = {
		count: 1,
		file: finding.file,
		rule: finding.rule,
		text: finding.text,
	};
	if (finding.engine !== undefined) {
		entry.engine = finding.engine;
	}
	return entry;
}

/**
 * 検出を識別項目ごとに件数付きで集計してbaselineを作る
 *
 * @param findings - baselineへ集計する検出の一覧
 * @returns 識別keyごとに件数をまとめて並べたbaseline
 */
export function createBaseline(findings: readonly BaselineKey[]): BaselineFile {
	const entries = new Map<string, BaselineEntry>();
	for (const finding of findings) {
		const key = entryKey(finding);
		const existing = entries.get(key);
		if (existing) {
			existing.count += 1;
			continue;
		}
		entries.set(key, toEntry(finding));
	}
	return { entries: [...entries.values()].sort(compareEntries), version: 1 };
}

/**
 * 現在の検出からbaseline済みを除き、解消済みentryを求める
 *
 * @typeParam TFinding - baselineのkeyとして扱える検出の型
 * @param findings - baselineと比較する現在の検出の一覧
 * @param baseline - 比較の基準にする読み込み済みのbaseline
 * @returns baselineに無い検出と、現在は検出されないbaselineのentry
 */
export function compareWithBaseline<TFinding extends BaselineKey>(
	findings: readonly TFinding[],
	baseline: BaselineFile,
): BaselineComparison<TFinding> {
	const remaining = new Map<string, number>();
	for (const entry of baseline.entries) {
		const key = entryKey(entry);
		remaining.set(key, (remaining.get(key) ?? 0) + entry.count);
	}
	const added: TFinding[] = [];
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

function isBaselineEntry(value: unknown): value is BaselineEntry {
	if (!isJsonObject(value)) {
		return false;
	}
	return (
		(value.engine === undefined || typeof value.engine === "string") &&
		typeof value.file === "string" &&
		typeof value.rule === "string" &&
		typeof value.text === "string" &&
		typeof value.count === "number"
	);
}

/**
 * baseline fileを読み込む 存在しない場合は空のbaselineを返す
 *
 * @param path - 読み込むbaseline fileのpath
 * @param label - 形式が違う場合のエラーに載せるbaselineの名前
 * @returns 読み込んだentry一覧、fileが存在しない場合は空のbaseline
 */
export function readBaseline(path: string, label: string): BaselineFile {
	if (!existsSync(path)) {
		return { entries: [], version: 1 };
	}
	const value: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (
		!isJsonObject(value) ||
		!Array.isArray(value.entries) ||
		!value.entries.every(isBaselineEntry)
	) {
		throw new Error(`${path} is not a ${label} baseline`);
	}
	return { entries: value.entries, version: 1 };
}

/**
 * baseline fileをタブ区切りのJSONで書き込む
 *
 * @param path - 書き込み先のbaseline fileのpath
 * @param baseline - タブ区切りのJSONへ変換して書き込むbaseline
 */
export function writeBaseline(path: string, baseline: BaselineFile): void {
	writeFileSync(path, `${JSON.stringify(baseline, null, "\t")}\n`);
}
