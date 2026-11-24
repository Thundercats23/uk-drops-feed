#!/usr/bin/env node
/**
 * Template: post new UK Drops Feed items to a Discord channel.
 * Uses a credit/trial token. Does not sign x402 payments.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Client, EmbedBuilder, GatewayIntentBits } from "discord.js";

const BASE = process.env.UKDF_BASE || "https://uk-drops-feed.8bitbudgets.workers.dev";
const TOKEN = process.env.UKDF_TRIAL_KEY || process.env.UKDF_CREDIT_TOKEN;
const TOKEN_HEADER = process.env.UKDF_TRIAL_KEY ? "X-Trial-Key" : "X-Credit-Token";
const BOT = process.env.DISCORD_BOT_TOKEN;
const CHANNEL = process.env.DISCORD_CHANNEL_ID;
const REGION = process.env.UKDF_REGION || "UK";
const FRANCHISE = process.env.UKDF_FRANCHISE || "pokemon-tcg";
const POLL_MS = Math.max(5, Number(process.env.UKDF_POLL_MINUTES || 30)) * 60_000;
const INCLUDE_RESTOCKS = process.env.UKDF_INCLUDE_RESTOCKS === "1";
const SEEN_PATH = new URL("./seen.json", import.meta.url);

if (!BOT || !CHANNEL) {
  console.error("Set DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID");
  process.exit(1);
}
if (!TOKEN) {
  console.error("Set UKDF_TRIAL_KEY (from POST /v1/trial-key) or UKDF_CREDIT_TOKEN.");
  process.exit(1);
}

function loadSeen() {
  if (!existsSync(SEEN_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SEEN_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveSeen(seen) {
  writeFileSync(SEEN_PATH, JSON.stringify(seen, null, 2));
}

function fingerprint(item) {
  return JSON.stringify({
    d: item.release_date || item.release_window || null,
    e: item.ends_on || null,
    s: item.status || null,
    p: item.price_from ?? item.rrp ?? item.price_from_local ?? null,
  });
}

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, [TOKEN_HEADER]: TOKEN },
  });
  const text = await res.text();
  if (res.status === 402) {
    throw new Error("402 Payment Required — token missing, empty, or not accepted on this route.");
  }
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

function itemsFrom(body) {
  if (Array.isArray(body?.drops)) return body.drops;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body?.restocks)) return body.restocks;
  if (Array.isArray(body)) return body;
  return [];
}

function sourceUrl(item) {
  const src = item.sources?.[0] || item.offers?.[0];
  return src?.url || item.url || item.link || null;
}

function embedFor(item, kind) {
  const when = item.release_date || item.release_window || item.ends_on || "Date not confirmed";
  const price =
    item.price_from != null ? `From £${item.price_from}` :
    item.rrp != null ? `RRP £${item.rrp}` :
    item.price_from_local != null ? `${item.currency || ""} ${item.price_from_local}`.trim() :
    "Price not published";
  const embed = new EmbedBuilder()
    .setTitle(item.product || item.name || item.id || "Drop")
    .setDescription(`${kind} · ${item.franchise || "unknown"} · ${item.region || REGION}`)
    .addFields(
      { name: "Date / window", value: String(when), inline: true },
      { name: "Price", value: String(price), inline: true },
    )
    .setFooter({ text: "UK Drops Feed — always check the retailer before buying." });
  const url = sourceUrl(item);
  if (url && /^https:\/\//.test(url)) embed.setURL(url);
  return embed;
}

async function poll(channel, seen) {
  const paths = [
    `/v1/drops/upcoming?franchise=${encodeURIComponent(FRANCHISE)}&days=30&limit=25&region=${encodeURIComponent(REGION)}`,
  ];
  if (INCLUDE_RESTOCKS) {
    paths.push(`/v1/drops/restocks?franchise=${encodeURIComponent(FRANCHISE)}`);
  }
  const fresh = [];
  for (const path of paths) {
    const kind = path.includes("restocks") ? "Restock" : "Upcoming";
    const body = await getJson(path);
    for (const item of itemsFrom(body)) {
      const id = item.id || sourceUrl(item) || item.product;
      if (!id) continue;
      const fp = fingerprint(item);
      if (seen[id] === fp) continue;
      seen[id] = fp;
      fresh.push({ item, kind });
    }
  }
  // Newest last so the latest ends up at the bottom of the channel
  for (const { item, kind } of fresh.slice(0, 10)) {
    await channel.send({ embeds: [embedFor(item, kind)] });
  }
  if (fresh.length) saveSeen(seen);
  console.log(`${new Date().toISOString()} posted ${Math.min(fresh.length, 10)} new item(s)`);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once("ready", async () => {
  const channel = await client.channels.fetch(CHANNEL);
  if (!channel || !channel.isTextBased()) {
    console.error("Channel not found or not text-based");
    process.exit(1);
  }
  const seen = loadSeen();
  const run = async () => {
    try {
      await poll(channel, seen);
    } catch (err) {
      console.error("poll failed:", err.message || err);
    }
  };
  await run();
  setInterval(run, POLL_MS);
});
client.login(BOT);
