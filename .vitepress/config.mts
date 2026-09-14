import path from "node:path";
import { defineConfig, type MarkdownRenderer } from "vitepress";

const repository = "https://github.com/yuu1111/configs";

/**
 * ja を既定localeにして en を `/en/` へ置く
 * `README.md` は npm と GitHub が要求する位置を動かせないため rewrite で移す
 */
const rewrites: Record<string, string> = {
	"README.ja.md": "index.md",
	"README.md": "en/index.md",
	"packages/config/biome-config/README.ja.md":
		"packages/config/biome-config/index.md",
	"packages/config/biome-config/README.md":
		"en/packages/config/biome-config/index.md",
	"packages/config/knip-config/README.ja.md":
		"packages/config/knip-config/index.md",
	"packages/config/knip-config/README.md":
		"en/packages/config/knip-config/index.md",
	"packages/config/tsconfig/README.ja.md": "packages/config/tsconfig/index.md",
	"packages/config/tsconfig/README.md": "en/packages/config/tsconfig/index.md",
	"packages/engine/quality-check/README.ja.md":
		"packages/engine/quality-check/index.md",
	"packages/engine/quality-check/README.md":
		"en/packages/engine/quality-check/index.md",
};

const sourceOfRewrite = Object.fromEntries(
	Object.entries(rewrites).map(([source, destination]) => [
		destination,
		source,
	]),
);

/**
 * rewrite後の配置をrouteへ直す `index`はdirectoryのrouteになる
 */
function routeOf(destination: string): string {
	const withoutExtension = destination.replace(/\.md$/, "");
	const withoutIndex = withoutExtension.replace(/(^|\/)index$/, "");
	if (withoutIndex === withoutExtension) {
		return `/${withoutExtension}`;
	}
	return `/${withoutIndex}${withoutIndex ? "/" : ""}`;
}

/**
 * 原稿の配置を基準にした相対リンクを、生成後のrouteへ直す
 * routeへ直せないリンクはundefinedを返し、そのままdead linkの検査へ任せる
 */
function localeRoute(href: string, source: string): string | undefined {
	const separator = href.search(/[#?]/);
	const target = separator < 0 ? href : href.slice(0, separator);
	if (!target.endsWith(".md") || /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(target)) {
		return undefined;
	}
	const resolved = path.posix.normalize(
		path.posix.join(path.posix.dirname(source), target),
	);
	if (resolved.startsWith("..")) {
		return undefined;
	}
	const suffix = separator < 0 ? "" : href.slice(separator);
	return routeOf(rewrites[resolved] ?? resolved) + suffix;
}

type MarkdownToken = ReturnType<MarkdownRenderer["parse"]>[number];

/**
 * inline tokenが持つ相対リンクを、原稿の配置を基準にrouteへ直す
 */
function rewriteInlineLinks(token: MarkdownToken, source: string): void {
	if (token.type !== "inline") {
		return;
	}
	for (const child of token.children ?? []) {
		if (child.type !== "link_open") {
			continue;
		}
		const href = child.attrGet("href");
		const route = href ? localeRoute(href, source) : undefined;
		if (route) {
			child.attrSet("href", route);
		}
	}
}

/**
 * 相対リンクはrewrite後の配置を基準に解決されるためlocaleをまたぐと外れる
 * 原稿の配置を基準に解決し直し、生成後のrouteへ置き換える
 */
function rewriteLocaleLinks(md: MarkdownRenderer): void {
	md.core.ruler.push("locale-links", (state) => {
		const env = state.env as { relativePath?: string } | undefined;
		if (!env?.relativePath) {
			return;
		}
		const source = sourceOfRewrite[env.relativePath] ?? env.relativePath;
		for (const token of state.tokens) {
			rewriteInlineLinks(token, source);
		}
	});
}

export default defineConfig({
	base: "/configs/",
	lang: "ja",
	title: "@yuu1111/configs",
	description: "プロジェクト横断で使う共有設定と検査engine",
	cleanUrls: true,
	sitemap: { hostname: "https://yuu1111.github.io/configs/" },
	srcExclude: ["AGENTS.md", "CLAUDE.md", "templates/**"],
	rewrites,
	markdown: { config: rewriteLocaleLinks },
	themeConfig: {
		socialLinks: [{ icon: "github", link: repository }],
		search: { provider: "local" },
		editLink: {
			pattern: `${repository}/edit/main/:path`,
			text: "GitHub でこのページを編集",
		},
	},
	locales: {
		root: {
			label: "日本語",
			lang: "ja",
			themeConfig: {
				nav: [
					{ text: "ガイド", link: "/docs/architecture" },
					{ text: "engine", link: "/docs/engines/code-style-check" },
					{ text: "package", link: "/packages/engine/quality-check/" },
				],
				sidebar: [
					{
						text: "ガイド",
						items: [
							{ text: "構成と設計判断", link: "/docs/architecture" },
							{ text: "プロジェクトへの導入", link: "/docs/adoption" },
							{ text: "engine の共通規約", link: "/docs/engine-contract" },
						],
					},
					{
						text: "engine",
						items: [
							{ text: "engine 一覧", link: "/docs/engines/" },
							{
								text: "code-style-check",
								link: "/docs/engines/code-style-check",
							},
							{ text: "comment-check", link: "/docs/engines/comment-check" },
							{
								text: "document-style-check",
								link: "/docs/engines/document-style-check",
							},
							{ text: "tsdoc-check", link: "/docs/engines/tsdoc-check" },
						],
					},
					{
						text: "package",
						items: [
							{
								text: "quality-check",
								link: "/packages/engine/quality-check/",
							},
							{ text: "biome-config", link: "/packages/config/biome-config/" },
							{ text: "knip-config", link: "/packages/config/knip-config/" },
							{ text: "tsconfig", link: "/packages/config/tsconfig/" },
						],
					},
				],
			},
		},
		en: {
			label: "English",
			lang: "en",
			title: "@yuu1111/configs",
			description: "Shared configuration and check packages published to npm",
			themeConfig: {
				nav: [{ text: "Packages", link: "/en/packages/engine/quality-check/" }],
				sidebar: [
					{
						text: "Packages",
						items: [
							{
								text: "@yuu1111/quality-check",
								link: "/en/packages/engine/quality-check/",
							},
							{
								text: "@yuu1111/biome-config",
								link: "/en/packages/config/biome-config/",
							},
							{
								text: "@yuu1111/knip-config",
								link: "/en/packages/config/knip-config/",
							},
							{
								text: "@yuu1111/tsconfig",
								link: "/en/packages/config/tsconfig/",
							},
						],
					},
				],
				editLink: {
					pattern: `${repository}/edit/main/:path`,
					text: "Edit this page on GitHub",
				},
			},
		},
	},
});
