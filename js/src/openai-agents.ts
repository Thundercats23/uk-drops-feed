import { z } from "zod";
import { DROP_KINDS, FRANCHISES, OFFER_CHANNELS, UkDropsFeedClient } from "./index.js";

export interface OpenAIAgentToolSpec<TParams extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  parameters: TParams;
  execute: (input: z.infer<TParams>) => Promise<string>;
}

/**
 * Tool definitions matching @openai/agents `tool({ name, description, parameters, execute })`.
 */
export function getOpenAIAgentsToolDefinitions(client: UkDropsFeedClient): OpenAIAgentToolSpec[] {
  return [
    {
      name: "ukdf_teaser",
      description:
        "Free: get the next 3 upcoming collectibles and video game drops. Default region is UK; pass US, CA, AU, EU, JP, or all.",
      parameters: z.object({
        region: z.string().default("UK").describe("Market region: UK, US, CA, AU, EU, JP, or all"),
      }),
      execute: async ({ region }) => JSON.stringify(await client.teaser(region)),
    },
    {
      name: "ukdf_upcoming_drops",
      description:
        "Get upcoming collectibles & video game drops, prereleases, sale windows and restock watches with dates, RRP and cited sources.",
      parameters: z.object({
        region: z.string().default("UK").describe("UK, US, CA, AU, EU, JP, or all"),
        franchise: z.enum(FRANCHISES).nullable().default(null),
        kind: z.enum(DROP_KINDS).nullable().default(null),
        channel: z.enum(OFFER_CHANNELS).nullable().default(null),
        days: z.number().int().min(1).max(365).default(60),
        limit: z.number().int().min(1).max(200).default(25),
      }),
      execute: async (input) =>
        JSON.stringify(
          await client.upcoming({
            region: input.region,
            franchise: input.franchise ?? undefined,
            kind: input.kind ?? undefined,
            channel: input.channel ?? undefined,
            days: input.days,
            limit: input.limit,
          }),
        ),
    },
    {
      name: "ukdf_restocks",
      description: "Get recent restocks and in-stock/preorder items from permitted retailers.",
      parameters: z.object({
        region: z.string().default("UK"),
        franchise: z.enum(FRANCHISES).nullable().default(null),
        channel: z.enum(OFFER_CHANNELS).nullable().default(null),
      }),
      execute: async (input) =>
        JSON.stringify(
          await client.restocks({
            region: input.region,
            franchise: input.franchise ?? undefined,
            channel: input.channel ?? undefined,
          }),
        ),
    },
    {
      name: "ukdf_tcg_calendar",
      description: "Get official TCG set street dates and prereleases.",
      parameters: z.object({
        region: z.string().default("UK"),
        franchise: z
          .enum(["pokemon-tcg", "mtg", "one-piece", "lorcana", "yugioh", "star-wars-unlimited"])
          .nullable()
          .default(null),
        days: z.number().int().min(1).max(365).default(120),
      }),
      execute: async (input) =>
        JSON.stringify(
          await client.calendar({
            region: input.region,
            franchise: input.franchise ?? undefined,
            days: input.days,
          }),
        ),
    },
  ];
}

/**
 * Build @openai/agents `tool(...)` instances ready for `new Agent({ tools: ... })`.
 */
export async function createOpenAIAgentsTools(client: UkDropsFeedClient): Promise<unknown[]> {
  const pkg = "@openai/agents";
  const mod: any = await import(pkg);
  return getOpenAIAgentsToolDefinitions(client).map((def) => mod.tool(def as any));
}
