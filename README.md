# UK Drops Feed

Client SDKs, agent tool wrappers, and templates for [UK Drops Feed](https://uk-drops-feed.8bitbudgets.workers.dev), a pay-per-call API and MCP server of official collectibles and video-game pre-order, restock, and release dates (covering **UK, US, Canada, Australia, NZ, EU, Japan** and more).

The live service is hosted at `https://uk-drops-feed.8bitbudgets.workers.dev`. This repository provides publishable **JavaScript/TypeScript** and **Python** SDKs (including **LangChain**, **CrewAI**, and **OpenAI Agents SDK** tool wrappers), the **OpenAPI 3.1 spec**, a **Discord bot** template + tutorial, an **n8n** workflow, and a **Make.com** outline.

**Docs:** [Homepage](https://uk-drops-feed.8bitbudgets.workers.dev) · [llms.txt](https://uk-drops-feed.8bitbudgets.workers.dev/llms.txt) · [OpenAPI 3.1](openapi.json) ([live](https://uk-drops-feed.8bitbudgets.workers.dev/openapi.json)) · [MCP](https://uk-drops-feed.8bitbudgets.workers.dev/mcp) · [Discord Bot Tutorial](docs/tutorial.md)

## What the feed is

- Official or permitted sources only. Always check the retailer before buying.
- Default region is `UK`. Official `US`, `CA`, `AU`, `NZ`, `EU`, `JP`, and other listed regions are available with `?region=` (or `?region=all`).
- Coverage includes TCG street dates and restocks (Pokémon, MTG, One Piece, Lorcana, Yu-Gi-Oh!, Star Wars: Unlimited), LEGO, official game and console launches (including GTA 6), and hand-curated restock watches. The feed does not scrape Amazon, Argos, lego.com, Jellycat, Nike, or adidas.
- No account is required to start.

## Pricing and trial

| Access | Cost |
|---|---|
| Free teaser (`GET /v1/teaser`) | Free — next 3 drops |
| Free MCP tool `next_drops` | Free |
| Trial key (`POST /v1/trial-key?ref=...`) | 25 free calls on the HTTP drop and brief routes. Send the key as `X-Trial-Key` or `Authorization: Bearer`. Up to 3 keys per day from one address. Does not cover `/v1/credits/buy` or `/v1/ask`. After 25 calls, x402 applies. |
| Drop and brief HTTP / MCP tools | $0.01 USDC on Base per call, via [x402](https://www.x402.org) |
| Prepaid pack (`POST /v1/credits/buy`) | $0.20 for 25 HTTP drop/brief calls (not MCP, `/v1/credits/buy`, or `/v1/ask`) |
| Hand-checked question (`POST /v1/ask`) | $0.15. Not instant, not financial advice. |

Unpaid paid routes return HTTP 402 (USDC on Base). Inspect the challenge before paying: amount `10000` (0.01 USDC, 6 decimals), network `eip155:8453` (Base), USDC contract `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

### No crypto wallet? (Card payments coming soon + 1-minute Coinbase guide)

**No crypto wallet? Card payments are coming soon.** You can still start today with **25 free trial calls** (`POST /v1/trial-key`, no signup or card required).

If you want to go beyond 25 calls right now with **$0.01 USDC per call on Base** (or **$0.20** for a 25-call pack):
1. Open **Coinbase** or the **Base App** (or MetaMask), buy or hold a small amount of **USDC** on the **Base** network (you don't need ETH for gas to sign an x402 payment).
2. Copy/connect a Base wallet private key (`EVM_PRIVATE_KEY`) to the `uk-drops-feed` JS/Python client (or any x402 buyer client) to pay automatically per call—or run `POST /v1/credits/buy` once to get a prepaid `cr_...` bearer token.

## MCP

Streamable HTTP, no key to connect:

`https://uk-drops-feed.8bitbudgets.workers.dev/mcp`

- `initialize`, `tools/list`, and `next_drops` are free.
- Paid tools (`upcoming_drops`, `tcg_calendar`, `uk_restocks`, `stock_status`, `drop_item`, `weekly_brief`) use x402. Prepaid HTTP credits do not apply to MCP.

Official registry name: `dev.workers.8bitbudgets.uk-drops-feed/uk-drops-feed`.

## What's in this repo

| Path | What it is |
|---|---|
| [`js/`](js/) | Publish-ready JS/TS package (`uk-drops-feed`) with trial/x402 client plus LangChain & OpenAI Agents SDK wrappers and examples |
| [`python/`](python/) | Publish-ready Python package (`uk-drops-feed`) with sync/async client plus LangChain, CrewAI & OpenAI Agents SDK wrappers and examples |
| [`docs/tutorial.md`](docs/tutorial.md) | Step-by-step guide: *Build a Pokémon Restock Discord Bot in 10 Minutes with x402* |
| [`openapi.json`](openapi.json) | OpenAPI 3.1.0 specification (mirrors `/openapi.json` on the live worker) |
| [`discord-bot/`](discord-bot/) | Alert-bot template that posts new official dates or restocks to a channel |
| [`n8n/`](n8n/) | Importable workflow using a trial or prepaid token |
| [`make/`](make/) | Make.com scenario outline using a trial or prepaid token |

## Rules baked into the examples

- Never hard-code a private key, trial key, credit token, or Discord bot token. Use environment variables.
- Inspect a `402` before paying (amount, network, and asset as above).
- These examples make no payments unless you set a key and run them yourself.

Official buyer docs: https://docs.x402.org/getting-started/quickstart-for-buyers

## Licence

[MIT](LICENSE)
