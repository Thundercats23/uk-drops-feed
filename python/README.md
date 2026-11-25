# uk-drops-feed (Python)

Official Python client and AI agent tool wrappers (**LangChain**, **CrewAI**, **OpenAI Agents SDK**) for [UK Drops Feed](https://uk-drops-feed.8bitbudgets.workers.dev).

- **Free teaser:** `GET /v1/teaser` (no key required)
- **Free trial:** `POST /v1/trial-key?ref=...` (25 free calls on `/v1/drops/*` and `/v1/briefs/*`, up to 3 keys/day per IP)
- **Prepaid credits:** `$0.20` USDC for 25 HTTP calls (`POST /v1/credits/buy`)
- **Pay-per-call x402:** `$0.01` USDC on Base mainnet per call (with built-in amount, network, USDC, and `payTo` checks)

## Install

```bash
pip install uk-drops-feed

# Optional extras:
pip install "uk-drops-feed[x402]"          # Base USDC payments via x402
pip install "uk-drops-feed[langchain]"     # LangChain StructuredTools
pip install "uk-drops-feed[crewai]"        # CrewAI BaseTools
pip install "uk-drops-feed[openai-agents]" # OpenAI Agents SDK @function_tool
```

## Quickstart

```python
from uk_drops_feed import UKDropsFeedClient

# auto_trial=True mints a 25-call free trial key on first paid-route call
with UKDropsFeedClient(auto_trial=True, trial_ref="my-app") as client:
    teaser = client.teaser("UK")
    upcoming = client.upcoming(franchise="pokemon-tcg", days=60, limit=10)
    restocks = client.restocks(franchise="pokemon-tcg")
```

## LangChain / CrewAI / OpenAI Agents SDK

```python
from uk_drops_feed import UKDropsFeedClient
from uk_drops_feed.langchain import get_langchain_tools
from uk_drops_feed.crewai import get_crewai_tools
from uk_drops_feed.openai_agents import get_openai_agents_tools

client = UKDropsFeedClient(auto_trial=True, trial_ref="agent-app")
lc_tools = get_langchain_tools(client)
crew_tools = get_crewai_tools(client)
oa_tools = get_openai_agents_tools(client)
```

## Standalone CLI (`client.py`)

```bash
python client.py teaser
UKDF_TRIAL_KEY=... python client.py upcoming
UKDF_DRY_RUN=1 python client.py upcoming
```

### No crypto wallet? (Card payments coming soon + 1-minute Coinbase guide)

**No crypto wallet? Card payments are coming soon.** You can still start today with **25 free trial calls** (`POST /v1/trial-key`, no signup or card required).

If you want to go beyond 25 calls right now with **$0.01 USDC per call on Base** (or **$0.20** for a 25-call pack):
1. Open **Coinbase** or the **Base App** (or MetaMask), buy or hold a small amount of **USDC** on the **Base** network (you don't need ETH for gas to sign an x402 payment).
2. Copy/connect a Base wallet private key (`EVM_PRIVATE_KEY`) to the `uk-drops-feed` JS/Python client (or any x402 buyer client) to pay automatically per call—or run `POST /v1/credits/buy` once to get a prepaid `cr_...` bearer token.
