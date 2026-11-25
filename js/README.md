# uk-drops-feed (JavaScript / TypeScript)

Official JS/TS client and AI agent tool wrappers for [UK Drops Feed](https://uk-drops-feed.8bitbudgets.workers.dev).

- **Free teaser:** `GET /v1/teaser` (no key required)
- **Free trial:** `POST /v1/trial-key?ref=...` (25 free calls on `/v1/drops/*` and `/v1/briefs/*`, up to 3 keys/day per IP)
- **Prepaid credits:** `$0.20` USDC for 25 HTTP calls (`POST /v1/credits/buy`)
- **Pay-per-call x402:** `$0.01` USDC on Base mainnet per call (with built-in amount, network, USDC, and `payTo` checks)

## Install

```bash
npm install uk-drops-feed
```

Needs Node 18+.

## Quickstart

```js
import { UkDropsFeedClient } from "uk-drops-feed";

// autoTrial mints a 25-call free trial key on first paid-route call
const client = new UkDropsFeedClient({ autoTrial: true, trialRef: "my-app" });

const teaser = await client.teaser("UK");
const upcoming = await client.upcoming({ franchise: "pokemon-tcg", days: 60, limit: 10 });
const restocks = await client.restocks({ franchise: "pokemon-tcg" });
```

### With an existing trial key, credit token, or Base wallet

```js
const withTrial = new UkDropsFeedClient({ trialKey: process.env.UKDF_TRIAL_KEY });
const withCredits = new UkDropsFeedClient({ creditToken: process.env.UKDF_CREDIT_TOKEN });
const withWallet = new UkDropsFeedClient({
  evmPrivateKey: process.env.EVM_PRIVATE_KEY,
  maxAtomicAmount: "200000", // cap at $0.20 USDC
});
```

## LangChain.js

```js
import { UkDropsFeedClient } from "uk-drops-feed";
import { createLangChainTools } from "uk-drops-feed/langchain";

const client = new UkDropsFeedClient({ autoTrial: true, trialRef: "langchain-js" });
const tools = await createLangChainTools(client);
```

## OpenAI Agents SDK (`@openai/agents`)

```js
import { UkDropsFeedClient } from "uk-drops-feed";
import { createOpenAIAgentsTools } from "uk-drops-feed/openai-agents";

const client = new UkDropsFeedClient({ autoTrial: true, trialRef: "openai-agents-js" });
const tools = await createOpenAIAgentsTools(client);
```

## CLI example (`example.mjs`)

```bash
node example.mjs teaser
UKDF_TRIAL_KEY=... node example.mjs upcoming
UKDF_DRY_RUN=1 node example.mjs upcoming
```

### No crypto wallet? (Card payments coming soon + 1-minute Coinbase guide)

**No crypto wallet? Card payments are coming soon.** You can still start today with **25 free trial calls** (`POST /v1/trial-key`, no signup or card required).

If you want to go beyond 25 calls right now with **$0.01 USDC per call on Base** (or **$0.20** for a 25-call pack):
1. Open **Coinbase** or the **Base App** (or MetaMask), buy or hold a small amount of **USDC** on the **Base** network (you don't need ETH for gas to sign an x402 payment).
2. Copy/connect a Base wallet private key (`EVM_PRIVATE_KEY`) to the `uk-drops-feed` JS/Python client (or any x402 buyer client) to pay automatically per call—or run `POST /v1/credits/buy` once to get a prepaid `cr_...` bearer token.
