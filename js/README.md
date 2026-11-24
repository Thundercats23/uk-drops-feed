# UK Drops Feed — JavaScript client

Minimal Node.js example that:

1. Fetches the **free** teaser (no wallet).
2. Calls a paid route with a **credit or trial token** if `UKDF_CREDIT_TOKEN` is set (no on-chain payment).
3. Otherwise pays **$0.01 USDC on Base** via official x402 libraries, after checking the 402 terms.

## Install

```bash
npm install
```

Needs Node 18+.

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `UKDF_TRIAL_KEY` | No | Free trial key from `POST /v1/trial-key`. Sent as `X-Trial-Key` (and Bearer). |
| `UKDF_CREDIT_TOKEN` | No | Prepaid pack token. Sent as `X-Credit-Token` and Bearer. |
| `EVM_PRIVATE_KEY` | Only for x402 pays | `0x`-prefixed Base wallet private key with a little USDC. **Never commit this.** |
| `UKDF_DRY_RUN` | No | If `1`, print the 402 terms and exit without paying. |

Optional: `UKDF_BASE` defaults to `https://uk-drops-feed.8bitbudgets.workers.dev`.

## Run

```bash
# Free, no key
node example.mjs teaser

# Get a trial key once (prints the token; store it, do not commit it)
curl -sS -X POST https://uk-drops-feed.8bitbudgets.workers.dev/v1/trial-key

# Trial key (no wallet)
UKDF_TRIAL_KEY=... node example.mjs upcoming

# Prepaid pack token (no wallet)
UKDF_CREDIT_TOKEN=... node example.mjs upcoming

# Inspect a 402 without spending
UKDF_DRY_RUN=1 node example.mjs upcoming

# Pay $0.01 once (real USDC). Only if you intend to.
EVM_PRIVATE_KEY=0x... node example.mjs upcoming
```

The paid example uses `GET /v1/drops/upcoming?franchise=pokemon-tcg&days=60&limit=10&region=UK` and aborts if the 402 is not exactly 0.01 USDC on Base to the published pay-to address.

Client pattern follows the official buyer quickstart: https://docs.x402.org/getting-started/quickstart-for-buyers
