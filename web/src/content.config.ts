import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.string(),
    updatedDate: z.string().optional(),
    keywords: z.array(z.string()),
    hub: z.string().nullable(),
    author: z.string(),
    heroImage: z.string().optional(),
    heroAlt: z.string(),
    schema: z.object({
      type: z.enum(['Article', 'WebPage']),
      about: z.string(),
      dataset: z.string().optional(),
    }),
    sitemap: z
      .object({
        priority: z.number().optional(),
        changefreq: z.string().optional(),
      })
      .optional(),
    faq: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        }),
      )
      .optional(),
  }),
});

export const collections = { blog };
