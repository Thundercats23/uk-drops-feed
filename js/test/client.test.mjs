import test from "node:test";
import assert from "node:assert/strict";
import { UkDropsFeedClient, UkDropsFeedError } from "../dist/index.js";
import { getLangChainToolSpecs } from "../dist/langchain.js";
import { getOpenAIAgentsToolDefinitions } from "../dist/openai-agents.js";

test("teaser, autoTrial mint with ref, and upcoming calls work", async () => {
  const seen = [];
  const mockFetch = async (url, init = {}) => {
    seen.push({ url: String(url), method: init.method || "GET", headers: init.headers || {} });
    const u = new URL(String(url));
    if (u.pathname === "/v1/teaser") {
      return new Response(JSON.stringify({ drops: [{ id: "a", product: "Drop A" }] }), { status: 200 });
    }
    if (u.pathname === "/v1/trial-key") {
      return new Response(JSON.stringify({ token: "tr_test_123", remaining: 10, pack: 10, issued_at: "2026-11-25T00:00:00Z", ref: u.searchParams.get("ref"), valid_for: ["/v1/drops/upcoming"] }), { status: 200 });
    }
    if (u.pathname === "/v1/drops/upcoming") {
      return new Response(JSON.stringify({ count: 1, drops: [{ id: "a", product: "Drop A" }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  };

  const client = new UkDropsFeedClient({ autoTrial: true, trialRef: "unit-test", fetch: mockFetch });
  const teaser = await client.teaser("UK");
  assert.equal(teaser.drops.length, 1);

  const up = await client.upcoming({ franchise: "pokemon-tcg", days: 30, limit: 5 });
  assert.equal(up.count, 1);
  assert.equal(client.getTrialKey(), "tr_test_123");

  const mintCall = seen.find((c) => c.url.includes("/v1/trial-key"));
  assert.ok(mintCall.url.includes("ref=unit-test"));
  const upCall = seen.find((c) => c.url.includes("/v1/drops/upcoming"));
  assert.equal(upCall.headers["X-Trial-Key"], "tr_test_123");
});

test("rejects 402 with wrong payTo without paying", async () => {
  const payload = Buffer.from(JSON.stringify({
    accepts: [{ amount: "10000", network: "eip155:8453", asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", payTo: "0x0000000000000000000000000000000000000001" }],
  })).toString("base64");
  const mockFetch = async () => new Response("{}", { status: 402, headers: { "payment-required": payload } });

  const client = new UkDropsFeedClient({
    evmPrivateKey: "0x0123456789012345678901234567890123456789012345678901234567890123",
    fetch: mockFetch,
  });
  await assert.rejects(() => client.upcoming(), (err) => err instanceof UkDropsFeedError && /payTo/.test(err.message));
});

test("LangChain and OpenAI Agents tool specs validate and execute", async () => {
  const mockFetch = async (url) => {
    const u = new URL(String(url));
    return new Response(JSON.stringify({ ok: true, path: u.pathname }), { status: 200 });
  };
  const client = new UkDropsFeedClient({ trialKey: "tr_abc", fetch: mockFetch });
  const lcTools = getLangChainToolSpecs(client);
  assert.equal(lcTools.length, 6);
  const lcOut = JSON.parse(await lcTools[0].func({ region: "UK" }));
  assert.equal(lcOut.path, "/v1/teaser");

  const oaTools = getOpenAIAgentsToolDefinitions(client);
  assert.equal(oaTools.length, 4);
  const oaOut = JSON.parse(await oaTools[1].execute({ region: "UK", franchise: "pokemon-tcg", kind: null, channel: null, days: 60, limit: 10 }));
  assert.equal(oaOut.path, "/v1/drops/upcoming");
});
