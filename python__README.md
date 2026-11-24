# UK Drops Feed — Python client

Same behaviour as the JavaScript example: free teaser, credit/trial token, or a capped x402 payment after inspecting the 402.

## Install

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `UKDF_TRIAL_KEY` | No | Free trial key from `POST /v1/trial-key` |
| `UKDF_CREDIT_TOKEN` | No | Prepaid pack token |
| `EVM_PRIVATE_KEY` | Only for x402 pays | `0x`-prefixed private key. **Never commit this.** |
| `UKDF_DRY_RUN` | No | If `1`, print 402 terms and exit without paying |

## Run

```bash
python client.py teaser
UKDF_TRIAL_KEY=... python client.py upcoming
UKDF_CREDIT_TOKEN=... python client.py upcoming
UKDF_DRY_RUN=1 python client.py upcoming
EVM_PRIVATE_KEY=0x... python client.py upcoming
```

Client pattern follows the official buyer quickstart (httpx): https://docs.x402.org/getting-started/quickstart-for-buyers
