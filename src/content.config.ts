import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

const showcase = defineCollection({
	loader: glob({ base: "./src/content/showcase", pattern: "**/*.{md,mdx}" }),
	schema: z.object({
		title: z.string(),
		tagline: z.string(),
		summary: z.string(),
		platforms: z.array(
			z.enum(["web", "android", "ios", "desktop", "macos", "windows", "linux"]),
		),
		status: z.enum(["live", "beta", "in-development", "archived"]),
		year: z.number().int(),
		featured: z.boolean().default(false),
		order: z.number().int().default(100),
		heroImage: z.string().optional(),
		links: z
			.object({
				// Accepts either an absolute URL or a site-relative path (e.g. "/play/defendor/").
				play: z.string().min(1).optional(),
				playStore: z.string().url().optional(),
				appStore: z.string().url().optional(),
				source: z.string().url().optional(),
				site: z.string().url().optional(),
			})
			.default({}),
	}),
});

export const collections = { showcase };
