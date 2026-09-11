import type { Finding } from "./rules";

/** baselineに記録する指摘1件の識別情報と件数 */
export interface BaselineEntry {
	rule: string;
	file: string;
	text: string;
	count: number;
}

/** baseline fileの形式と記録済みentryの一覧 */
export interface BaselineFile {
	version: 1;
	entries: BaselineEntry[];
}

/** baselineと現在の指摘を比較した結果 */
export interface BaselineComparison {
	added: Finding[];
	resolved: BaselineEntry[];
}

/** entryをbaseline上で一意に識別するkeyを返す */
export function entryKey(entry: {
	rule: string;
	file: string;
	text: string;
}): string {
	return [entry.rule, entry.file, entry.text].join("\u0000");
}

function compareEntries(left: BaselineEntry, right: BaselineEntry): number {
	const leftKey = entryKey(left);
	const rightKey = entryKey(right);
	if (leftKey === rightKey) {
		return 0;
	}
	return leftKey < rightKey ? -1 : 1;
}

/** 指摘一覧を件数付きentryへ集計してbaselineを作成する */
export function createBaseline(findings: Finding[]): BaselineFile {
	const entries = new Map<string, BaselineEntry>();
	for (const finding of findings) {
		const key = entryKey(finding);
		const existing = entries.get(key);
		if (existing) {
			existing.count += 1;
			continue;
		}
		entries.set(key, {
			rule: finding.rule,
			file: finding.file,
			text: finding.text,
			count: 1,
		});
	}
	return { version: 1, entries: [...entries.values()].sort(compareEntries) };
}

/** 現在の指摘とbaselineを突き合わせ、新規追加分と解消済み分を求める */
export function compareWithBaseline(
	findings: Finding[],
	baseline: BaselineFile,
): BaselineComparison {
	const remaining = new Map<string, number>();
	for (const entry of baseline.entries) {
		const key = entryKey(entry);
		remaining.set(key, (remaining.get(key) ?? 0) + entry.count);
	}

	const added: Finding[] = [];
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
