import { defineConfig } from "vitepress";

const repository = "https://github.com/yuu1111/configs";

export default defineConfig({
	base: "/configs/",
	lang: "ja",
	title: "@yuu1111/configs",
	description: "プロジェクト横断で使う共有設定と検査engine",
	cleanUrls: true,
	sitemap: { hostname: "https://yuu1111.github.io/configs/" },
	srcExclude: ["AGENTS.md", "CLAUDE.md", "templates/**"],
	rewrites: {
		"README.ja.md": "index.md",
		"packages/config/biome-config/README.ja.md":
			"packages/config/biome-config/index.md",
		"packages/config/knip-config/README.ja.md":
			"packages/config/knip-config/index.md",
		"packages/config/tsconfig/README.ja.md":
			"packages/config/tsconfig/index.md",
		"packages/engine/quality-check/README.ja.md":
			"packages/engine/quality-check/index.md",
	},
	themeConfig: {
		socialLinks: [{ icon: "github", link: repository }],
		search: { provider: "local" },
		editLink: {
			pattern: `${repository}/edit/main/:path`,
			text: "GitHub でこのページを編集",
		},
		nav: [
			{ text: "ガイド", link: "/docs/architecture" },
			{ text: "engine", link: "/docs/engines/code-style-check" },
			{ text: "package", link: "/packages/engine/quality-check/" },
			{ text: "English", link: "/README" },
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
					{ text: "code-style-check", link: "/docs/engines/code-style-check" },
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
					{ text: "quality-check", link: "/packages/engine/quality-check/" },
					{ text: "biome-config", link: "/packages/config/biome-config/" },
					{ text: "knip-config", link: "/packages/config/knip-config/" },
					{ text: "tsconfig", link: "/packages/config/tsconfig/" },
				],
			},
			{
				text: "English",
				items: [
					{ text: "Overview", link: "/README" },
					{
						text: "quality-check",
						link: "/packages/engine/quality-check/README",
					},
					{
						text: "biome-config",
						link: "/packages/config/biome-config/README",
					},
					{ text: "knip-config", link: "/packages/config/knip-config/README" },
					{ text: "tsconfig", link: "/packages/config/tsconfig/README" },
				],
			},
		],
	},
});
