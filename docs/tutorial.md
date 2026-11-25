# Build a Pokémon Restock Discord Bot in 10 Minutes with x402

If you run a Discord server for collectors—or you're building an AI shopping/alert agent—you know the worst part isn't the Discord bot. It's building and fixing fragile scrapers for twenty different toy and TCG stores, only to get blocked by Cloudflare or break on a layout tweak.

In this tutorial, you'll build a working **Pokémon TCG restock and release-date Discord bot** in about 10 minutes using **UK Drops Feed**—a pay-per-call API and MCP server covering official TCG pre-orders, restocks, and street dates across the **UK, US, Canada, Australia, EU, and Japan** from official announcements and permitted retailers.

Best part: you **don't need a crypto wallet to start**. You can mint a **25-call free trial key** with one `POST` request (no signup, no email), then optionally graduate to **$0.01 USDC per call on Base via x402** or a **$0.20 prepaid 25-call pack**.

> Live API & docs: [`llms.txt`](https://uk-drops-feed.8bitbudgets.workers.dev/llms.txt) · [`openapi.json`](https://uk-drops-feed.8bitbudgets.workers.dev/openapi.json) · [GitHub repo](https://github.com/Thundercats23/uk-drops-feed) · [Launch thread on X](https://x.com/i/status/2125504264197796091)

---

## What we're building

A small Node.js bot that:
1. Polls `/v1/drops/upcoming` and `/v1/drops/restocks` for Pokémon TCG drops.
2. Deduplicates drops in a local `seen.json` file so your channel only gets notified when a date, status, or price changes.
3. Posts clean Discord embeds with the product name, release date/window, price, stock status, and cited source link.
4. Starts on a free 25-call trial key (`POST /v1/trial-key`), with a one-line upgrade path to x402 micropayments on Base.

---

## Step 1: Create your Discord bot token (2 minutes)

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**.
2. Open the **Bot** tab, click **Reset Token**, and copy your `DISCORD_BOT_TOKEN`.
3. Under **OAuth2 → URL Generator**, select the `bot` scope and give it **Send Messages** and **Embed Links** permissions. Open the generated URL to invite the bot to your test server.
4. Enable **Developer Mode** in Discord (*Settings → Advanced*), right-click your target channel, and click **Copy Channel ID** (`DISCORD_CHANNEL_ID`).

---

## Step 2: Grab a free 25-call trial key (30 seconds)

No account or API dashboard needed. Mint a trial key straight from your terminal (pass `?ref=tutorial` or your own tag):

```bash
curl -sS -X POST "https://uk-drops-feed.8bitbudgets.workers.dev/v1/trial-key?ref=tutorial"
```

You'll get a JSON response like:

```json
{
  "token": "tr_...",
  "remaining": 10,
  "pack": 10,
  "issued_at": "2026-11-25T08:17:00.000Z",
  "ref": "tutorial",
  "valid_for": [
    "/v1/drops/upcoming",
    "/v1/drops/calendar",
    "/v1/drops/restocks",
    "/v1/drops/status",
    "/v1/drops/item/{id}",
    "/v1/briefs/weekly"
  ]
}
```

Save that `token`—never commit it to git. (There's also a completely free, no-key `/v1/teaser` endpoint returning the next 3 drops if you just want to peek first.)

---

## Step 3: Set up the Node.js project (2 minutes)

```bash
mkdir pokemon-drops-bot && cd pokemon-drops-bot
npm init -y
npm pkg set type=module
npm install discord.js
```

*(Requires Node.js 18+ for built-in `fetch`.)*

---

## Step 4: Write `bot.mjs` (4 minutes)

Create `bot.mjs`:

```js
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Client, EmbedBuilder, GatewayIntentBits } from "discord.js";

const BASE = "https://uk-drops-feed.8bitbudgets.workers.dev";
const TRIAL_KEY = process.env.UKDF_TRIAL_KEY;
const CREDIT_TOKEN = process.env.UKDF_CREDIT_TOKEN;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const REGION = process.env.UKDF_REGION || "UK"; // e.g. UK, US, CA, JP, or all
const POLL_MS = Math.max(5, Number(process.env.UKDF_POLL_MINUTES || 30)) * 60_000;
const SEEN_FILE = "./seen.json";

if (!BOT_TOKEN || !CHANNEL_ID) {
  throw new Error("Set DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID");
}
if (!TRIAL_KEY && !CREDIT_TOKEN) {
  throw new Error("Set UKDF_TRIAL_KEY (from POST /v1/trial-key) or UKDF_CREDIT_TOKEN");
}

function authHeaders() {
  if (TRIAL_KEY) return { "X-Trial-Key": TRIAL_KEY, Authorization: `Bearer ${TRIAL_KEY}` };
  return { "X-Credit-Token": CREDIT_TOKEN, Authorization: `Bearer ${CREDIT_TOKEN}` };
}

function loadSeen() {
  if (!existsSync(SEEN_FILE)) return {};
  try {
    return JSON.parse(readFileSync(SEEN_FILE, "utf8"));
  } catch {
    return {};
  }
}

function fingerprint(drop) {
  return JSON.stringify({
    date: drop.release_date ?? drop.release_window ?? null,
    status: drop.status?.stock_status ?? drop.stock_status ?? null,
    price: drop.price_from_gbp ?? drop.rrp_gbp ?? drop.price_from_local ?? drop.price_gbp ?? null,
    note: drop.status?.note ?? null,
  });
}

function formatPrice(drop) {
  if (drop.price_from_gbp != null) return `From £${drop.price_from_gbp}`;
  if (drop.price_gbp != null) return `£${drop.price_gbp}`;
  if (drop.rrp_gbp != null) return `RRP £${drop.rrp_gbp}`;
  if (drop.price_from_local != null) return `${drop.currency || ""} ${drop.price_from_local}`.trim();
  return "Not published";
}

function sourceUrl(drop) {
  return drop.sources?.[0]?.url || drop.offers?.[0]?.url || drop.url || null;
}

function buildEmbed(drop, label) {
  const when = drop.release_date || drop.release_window || "TBC";
  const status = drop.status?.stock_status || drop.stock_status || "see source";
  const embed = new EmbedBuilder()
    .setTitle(drop.product || drop.id || "Pokémon TCG Drop")
    .setDescription(`${label} · ${drop.region || REGION} · Status: **${status}**`)
    .addFields(
      { name: "Date / Window", value: String(when), inline: true },
      { name: "Price", value: formatPrice(drop), inline: true },
    )
    .setFooter({ text: "UK Drops Feed · Always check the retailer before buying" });

  if (drop.status?.note) {
    embed.addFields({ name: "Note", value: String(drop.status.note).slice(0, 1024) });
  }
  const url = sourceUrl(drop);
  if (url && url.startsWith("https://")) embed.setURL(url);
  return embed;
}

async function fetchJson(path) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  if (res.status === 402) {
    throw new Error("402 Payment Required: trial calls used up—switch to a prepaid pack or x402.");
  }
  if (!res.ok) {
    throw new Error(`${path} returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

async function poll(channel, seen) {
  const upcoming = await fetchJson(
    `/v1/drops/upcoming?franchise=pokemon-tcg&days=60&limit=15&region=${encodeURIComponent(REGION)}`,
  );
  const restocks = await fetchJson(
    `/v1/drops/restocks?franchise=pokemon-tcg&region=${encodeURIComponent(REGION)}`,
  );

  const candidates = [
    ...(upcoming.drops || []).map((d) => ({ drop: d, label: "Upcoming / Watch" })),
    ...(restocks.in_stock_now || []).map((d) => ({ drop: d, label: "In Stock Now" })),
    ...(restocks.events || []).map((d) => ({ drop: d, label: "Restock Event" })),
  ];

  const fresh = [];
  for (const { drop, label } of candidates) {
    const id = drop.drop_id || drop.id || drop.product;
    if (!id) continue;
    const fp = fingerprint(drop);
    if (seen[id] === fp) continue;
    seen[id] = fp;
    fresh.push({ drop, label });
  }

  for (const { drop, label } of fresh.slice(0, 8)) {
    await channel.send({ embeds: [buildEmbed(drop, label)] });
  }
  if (fresh.length) writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2));
  console.log(`[${new Date().toISOString()}] Posted ${Math.min(fresh.length, 8)} update(s)`);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once("ready", async () => {
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel || !channel.isTextBased()) throw new Error("Invalid text channel");
  const seen = loadSeen();
  const run = () => poll(channel, seen).catch((err) => console.error("Poll error:", err.message));
  await run();
  setInterval(run, POLL_MS);
});

client.login(BOT_TOKEN);
```

Run it:

```bash
UKDF_TRIAL_KEY="tr_..." \
DISCORD_BOT_TOKEN="your-bot-token" \
DISCORD_CHANNEL_ID="123456789012345678" \
UKDF_REGION="UK" \
node bot.mjs
```

Want **US** or **global** alerts instead? Pass `UKDF_REGION=US` or `UKDF_REGION=all`.

---

## Step 5: Going past 25 free calls (Prepaid or x402 on Base)

Once your 25 free trial calls are used, paid routes return **HTTP 402 Payment Required** with standard x402 terms (`10000` atomic units = **$0.01 USDC** on Base mainnet `eip155:8453`).

**No crypto wallet? Card payments are coming soon.** If you want to pay today with USDC on Base via Coinbase:

1. In **Coinbase** or the **Base App**, buy or hold a small amount of **USDC on Base** (no ETH gas needed for x402 signatures).
2. Connect a Base key (`EVM_PRIVATE_KEY`) to the SDK or buy a prepaid pack once.

You have two options:

1. **Prepaid 25-call pack ($0.20 USDC):** Hit `POST /v1/credits/buy` via x402 once, get a `cr_...` bearer token, and pass it as `UKDF_CREDIT_TOKEN` in the exact same `bot.mjs` code above (no wallet needed on your bot host!).
2. **Pay-per-call with `uk-drops-feed` SDK:** Install the client package (`npm install uk-drops-feed` or `pip install uk-drops-feed`) and pass `evmPrivateKey`:

```js
import { UkDropsFeedClient } from "uk-drops-feed";

const feed = new UkDropsFeedClient({
  evmPrivateKey: process.env.EVM_PRIVATE_KEY,
  maxAtomicAmount: "20000", // safety cap: max $0.02 USDC per call
});

const data = await feed.upcoming({ franchise: "pokemon-tcg", region: "all", days: 60 });
```

Building with **LangChain**, **CrewAI**, or the **OpenAI Agents SDK** instead of Discord? The same package includes ready-made tool wrappers (`uk-drops-feed/langchain`, `uk-drops-feed/openai-agents`, and `uk_drops_feed.crewai`) plus an [OpenAPI 3.1 spec](https://uk-drops-feed.8bitbudgets.workers.dev/openapi.json) and a [remote MCP server](https://uk-drops-feed.8bitbudgets.workers.dev/mcp) with a free `next_drops` tool.

---

## What next?

- Check out the client repo & templates (JS, Python, Discord, n8n, Make): https://github.com/Thundercats23/uk-drops-feed
- Read the agent-friendly API docs: https://uk-drops-feed.8bitbudgets.workers.dev/llms.txt
- Follow or reply on the launch post on X: https://x.com/i/status/2125504264197796091
