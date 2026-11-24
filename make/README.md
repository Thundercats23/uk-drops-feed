# UK Drops Feed — Make.com example

Make.com also has no native x402 signer. Use a **credit or trial token** in an HTTP module.

Get a trial key once (`POST https://uk-drops-feed.8bitbudgets.workers.dev/v1/trial-key`) and store it in a Make connection as `X-Trial-Key`. Do not request a new key on every run (3 keys/day per address). After 10 calls, buy a 25-call pack (`POST /v1/credits/buy`, $0.20) and switch to `X-Credit-Token`. Do not put the token in a public blueprint.

## Scenario (build in the Make UI)

1. **Scheduler** — every 30+ minutes (each run is a paid call).
2. **HTTP → Make a request**
   - Method: GET
   - URL: `https://uk-drops-feed.8bitbudgets.workers.dev/v1/drops/upcoming?franchise=pokemon-tcg&days=30&limit=25&region=UK`
   - Header: `X-Credit-Token: {{token}}` (or `Authorization: Bearer {{token}}`)
   - Parse response as JSON.
3. **Filter** — only continue if status is 200. If 402, notify yourself and stop. Do not tight-loop.
4. **Iterator** — over `drops` (or `items`).
5. **Data store / Google Sheet** — lookup the drop `id`. Skip if the stored fingerprint (date + price) matches.
6. **Discord / Slack / email** — post new items: product, region, date or window, cited link. Footer: check the retailer before buying.
7. **Write** the new fingerprint back to the store.

A JSON outline of the same steps is in `scenario-outline.json`. Make blueprints are account-specific; import the outline as a checklist rather than a one-click file.

## Cost

Same as the n8n example: 48 calls/day at a 30-minute schedule. Start slower while testing.

## Free test

Use `GET https://uk-drops-feed.8bitbudgets.workers.dev/v1/teaser?region=UK` with no token to prove the scenario posts correctly, then switch to `/v1/drops/upcoming`.
