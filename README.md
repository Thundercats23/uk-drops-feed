# UK Drops Feed

Client examples and templates for [UK Drops Feed](https://uk-drops-feed.8bitbudgets.workers.dev), a pay-per-call API and MCP server of official collectibles and video-game pre-order, restock and release dates.

The live service is hosted at the URL above. This repository is starter code only (JavaScript and Python clients, a Discord alert-bot template, an n8n workflow, and a Make.com outline). It is not the worker itself.

**Docs:** [https://uk-drops-feed.8bitbudgets.workers.dev](https://uk-drops-feed.8bitbudgets.workers.dev) · [llms.txt](https://uk-drops-feed.8bitbudgets.workers.dev/llms.txt) · [OpenAPI](https://uk-drops-feed.8bitbudgets.workers.dev/openapi.json) · [MCP](https://uk-drops-feed.8bitbudgets.workers.dev/mcp)

## What the feed is

- Official or permitted sources only. Always check the retailer before buying.
- Default region is the UK. Official US, Canada and other listed regions are available with `?region=`.
- Coverage includes TCG street dates and restocks (Pokémon, MTG, One Piece, Lorcana, Yu-Gi-Oh!, Star Wars: Unlimited), LEGO, official game and console launches, and hand-curated restock watches. The feed does not scrape Amazon, Argos, lego.com, Jellycat, Nike or adidas.
- No account is required to start.

## Pricing and trial

| Access | Cost |
|---|---|
| Free teaser (`GET /v1/teaser`) | Free — next 3 drops |
| Free MCP tool `next_drops` | Free |
| Trial key (`POST /v1/trial-key`) | 10 free calls on the HTTP drop and brief routes. Send the key as `X-Trial-Key` or `Authorization: Bearer`. Up to 3 keys per day from one address. Does not cover `/v1/credits/buy` or `/v1/ask`. After 10 calls, the normal payment request applies. |
| Drop and brief HTTP / MCP tools | $0.01 USDC on Base per call, via [x402](https://www.x402.org) |
| Prepaid pack (`POST /v1/credits/buy`) | $0.20 for 25 HTTP drop/brief calls (not MCP, `/v1/credits/buy` or `/v1/ask`) |
| Hand-checked question (`POST /v1/ask`) | $0.15. Not instant, not financial advice. |

Unpaid paid routes return HTTP 402 (USDC on Base). Inspect the challenge before paying: amount `10000` (0.01 USDC, 6 decimals), network `eip155:8453` (Base), USDC contract `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

## MCP

Streamable HTTP, no key to connect:

`https://uk-drops-feed.8bitbudgets.workers.dev/mcp`

- `initialize`, `tools/list` and `next_drops` are free.
- Paid tools (`upcoming_drops`, `tcg_calendar`, `uk_restocks`, `stock_status`, `drop_item`, `weekly_brief`) use x402. Prepaid HTTP credits do not apply to MCP.

Official registry name: `dev.workers.8bitbudgets.uk-drops-feed/uk-drops-feed`.

## What's in this repo

| Path | What it is |
|---|---|
| [`js/`](js/) | Tiny Node client: free teaser, trial or credit token, or x402 payment with a spend cap |
| [`python/`](python/) | Same in Python (`x402[httpx]` official client) |
| [`discord-bot/`](discord-bot/) | Alert-bot template that posts new official dates or restocks to a channel |
| [`n8n/`](n8n/) | Importable workflow using a trial or prepaid token (n8n cannot sign x402 itself) |
| [`make/`](make/) | Make.com scenario outline, same token path |

## Rules baked into the examples

- Never hard-code a private key, trial key, credit token or Discord bot token. Use environment variables.
- Inspect a `402` before paying (amount, network and asset as above).
- These examples make no payments unless you set a key and run them yourself.

Official buyer docs: https://docs.x402.org/getting-started/quickstart-for-buyers

## Licence

[MIT](LICENSE)
