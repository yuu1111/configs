import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_CONFIG_FILE } from "./defaults";
import { parseConfig } from "./parse";
import type { QualityConfig } from "./types";

/**
 * 作業ディレクトリからconfig fileを探す
 *
 * @param cwd - 探索を開始する作業ディレクトリのpath
 * @returns 見つけたconfig fileのpath 見つからなければnull
 */
export function findConfigFile(cwd: string): string | null {
	const candidate = resolve(cwd, DEFAULT_CONFIG_FILE);
	return existsSync(candidate) ? candidate : null;
}

/**
 * config fileを読み込んで検証する
 *
 * @param path - 読み込むconfig fileのpath
 * @returns 読み込んで検証した統合検査の設定
 */
export function loadConfig(path: string): QualityConfig {
	const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
	return parseConfig(JSON.parse(text), path);
}
