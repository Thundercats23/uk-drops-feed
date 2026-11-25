import { z } from "zod";
import { DROP_KINDS, FRANCHISES, OFFER_CHANNELS, UkDropsFeedClient } from "./index.js";

export interface LangChainToolSpec<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: TSchema;
  func: (input: z.infer<TSchema>) => Promise<string>;
}

/**
 * Plain tool specs (name, description, Zod schema, async func -> JSON string).
 * Works directly or with createLangChainTools(client).
 */
export function getLangChainToolSpecs(client: UkDropsFeedClient): LangChainToolSpec[] {
  return [
    {
      name: "ukdf_teaser",
      description:
        "Free: get the next 3 upcoming collectibles and video game drops (Pokemon, MTG, One Piece, Lorcana, LEGO, GTA 6). Default region=UK; pass US, CA, AU, EU, JP, or all.",
      schema: z.object({
        region: z.string().optional().describe("Market region code: UK (default), US, CA, AU, EU, JP, or all"),
      }),
      func: async ({ region }) => JSON.stringify(await client.teaser(region ?? "UK")),
    },
    {
      name: "ukdf_upcoming_drops",
      description:
        "Get upcoming collectibles and video game releases, prereleases, sale windows and restock watches with dates, RRP and cited sources. Uses 1 trial/credit call or $0.01 x402.",
      schema: z.object({
        region: z.string().optional().describe("UK (default), US, CA, AU, EU, JP, or all"),
        franchise: z.enum(FRANCHISES).optional().describe("Filter to a franchise"),
        kind: z.enum(DROP_KINDS).optional().describe("Drop kind filter"),
        channel: z.enum(OFFER_CHANNELS).optional().describe("Retailer offer channel"),
        days: z.number().int().min(1).max(365).optional().describe("Lookahead window in days (default 60)"),
        limit: z.number().int().min(1).max(200).optional().describe("Max results (default 50)"),
      }),
      func: async (input) => JSON.stringify(await client.upcoming(input)),
    },
    {
      name: "ukdf_tcg_calendar",
      description:
        "Get official TCG set and product street dates (Pokemon, MTG, One Piece, Lorcana, Yu-Gi-Oh!, Star Wars: Unlimited). Uses 1 trial/credit call or $0.01 x402.",
      schema: z.object({
        region: z.string().optional().describe("UK (default), US, CA, AU, EU, JP, or all"),
        franchise: z
          .enum(["pokemon-tcg", "mtg", "one-piece", "lorcana", "yugioh", "star-wars-unlimited"])
          .optional(),
        days: z.number().int().min(1).max(365).optional().describe("Lookahead days (default 120)"),
      }),
      func: async (input) => JSON.stringify(await client.calendar(input)),
    },
    {
      name: "ukdf_restocks",
      description:
        "Get recent restocks and in-stock/preorder items from permitted retailers and curated checks. Uses 1 trial/credit call or $0.01 x402.",
      schema: z.object({
        region: z.string().optional().describe("UK (default), US, CA, or all"),
        franchise: z.enum(FRANCHISES).optional(),
        channel: z.enum(OFFER_CHANNELS).optional(),
        since: z.string().optional().describe("ISO 8601 timestamp"),
      }),
      func: async (input) => JSON.stringify(await client.restocks(input)),
    },
    {
      name: "ukdf_stock_status",
      description:
        "Get curated stock, preorder and purchase-limit status for high-demand drops. Uses 1 trial/credit call or $0.01 x402.",
      schema: z.object({
        ids: z.array(z.string()).optional().describe("Optional drop IDs"),
        region: z.string().optional(),
        franchise: z.enum(FRANCHISES).optional(),
      }),
      func: async (input) => JSON.stringify(await client.status(input)),
    },
    {
      name: "ukdf_weekly_brief",
      description:
        "Get this week's official-source games and TCG brief with confirmed/rumoured flags. Uses 1 trial/credit call or $0.01 x402.",
      schema: z.object({
        franchise: z.enum(FRANCHISES).optional(),
        week: z.string().optional().describe("Any YYYY-MM-DD inside the target week"),
      }),
      func: async (input) => JSON.stringify(await client.weeklyBrief(input)),
    },
  ];
}

/**
 * Build @langchain/core DynamicStructuredTool instances ready to pass to an agent or model.bindTools().
 */
export async function createLangChainTools(client: UkDropsFeedClient): Promise<unknown[]> {
  const pkg = "@langchain/core/tools";
  const mod: any = await import(pkg);
  const DynamicStructuredTool = mod.DynamicStructuredTool;
  return getLangChainToolSpecs(client).map(
    (spec) =>
      new DynamicStructuredTool({
        name: spec.name,
        description: spec.description,
        schema: spec.schema,
        func: spec.func,
      }),
  );
}
