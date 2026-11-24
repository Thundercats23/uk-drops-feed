# UK Drops Feed — n8n example

n8n has no built-in x402 signer, so this workflow uses a **credit or trial token**. That is the realistic path for no-code tools.

Get a trial key once (`curl -X POST https://uk-drops-feed.8bitbudgets.workers.dev/v1/trial-key`), store it in n8n credentials as header `X-Trial-Key`, and do not request a new key on every run (limit is 3 keys per day per address). After 10 calls, buy a 25-call pack (`POST /v1/credits/buy`, $0.20 USDC) and switch the header to `X-Credit-Token`.

## What the workflow does

1. **Schedule** — every 30 minutes (change this; each run is a paid call).
2. **HTTP Request** — `GET /v1/drops/upcoming?franchise=pokemon-tcg&days=30&limit=25&region=UK` with header `X-Credit-Token` (or `Authorization: Bearer`).
3. **If 402 / not 200** — stop and notify. Do not retry in a tight loop (that can spend tokens or get you rate-limited).
4. **Compare** with items stored in n8n static data (or a simple Data Store) by drop `id`.
5. **Post new items** to Discord / Slack / email, including: product, region, date or window, and a cited link. Always tell readers to check the retailer before buying.

## Import

In n8n: **Workflows → Import from file** and choose `uk-drops-feed-upcoming.json`. Then:

1. Create a Header Auth credential named `UK Drops Feed token`: header `X-Credit-Token`, value = your token.
2. Attach it to the HTTP Request node.
3. Set your Discord webhook (or replace that node).
4. Activate.

Free teaser test (no token): change the URL to `https://uk-drops-feed.8bitbudgets.workers.dev/v1/teaser?region=UK` and remove the auth header.

## Cost

30-minute polls = 48 calls/day. At $0.01 that is $0.48/day, or two prepaid packs ($0.40) if you use credits. Start at 2–6 hours while testing.
