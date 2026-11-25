#!/usr/bin/env python3
"""Tiny UK Drops Feed client: teaser, credit token, or x402 pay-after-inspect."""

from __future__ import annotations

import asyncio
import base64
import json
import os
import sys
from typing import Any

import httpx

BASE = os.environ.get("UKDF_BASE", "https://uk-drops-feed.8bitbudgets.workers.dev")
PAY_TO = "0xb3f6872E6ffeA3f8Da7a5d5EB52ed2a5e15D60AA".lower()
USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
DROP_AMOUNT = "10000"
NETWORK = "eip155:8453"
UPCOMING = "/v1/drops/upcoming?franchise=pokemon-tcg&days=60&limit=10&region=UK"


def credit_headers() -> dict[str, str]:
    trial = os.environ.get("UKDF_TRIAL_KEY")
    if trial:
        return {"Authorization": f"Bearer {trial}", "X-Trial-Key": trial}
    token = os.environ.get("UKDF_CREDIT_TOKEN")
    if not token:
        return {}
    return {"Authorization": f"Bearer {token}", "X-Credit-Token": token}


def decode_payment_required(headers: httpx.Headers) -> dict[str, Any] | None:
    raw = headers.get("payment-required") or headers.get("PAYMENT-REQUIRED")
    if not raw:
        return None
    try:
        return json.loads(base64.b64decode(raw))
    except Exception:
        return None


def assert_drop_terms(req: dict[str, Any] | None) -> dict[str, Any]:
    accepts = (req or {}).get("accepts") or []
    if not accepts:
        raise SystemExit("402 had no accepts[]")
    a = accepts[0]
    if a.get("amount") != DROP_AMOUNT:
        raise SystemExit(f"unexpected amount {a.get('amount')}, wanted {DROP_AMOUNT}")
    if a.get("network") != NETWORK:
        raise SystemExit(f"unexpected network {a.get('network')}")
    if str(a.get("asset", "")).lower() != USDC.lower():
        raise SystemExit("unexpected asset")
    if str(a.get("payTo", "")).lower() != PAY_TO:
        raise SystemExit("unexpected payTo")
    return a


async def teaser() -> None:
    async with httpx.AsyncClient(timeout=30) as http:
        res = await http.get(f"{BASE}/v1/teaser", params={"region": "UK"})
        res.raise_for_status()
        print(json.dumps(res.json(), indent=2))


async def upcoming_with_token() -> None:
    async with httpx.AsyncClient(timeout=30) as http:
        res = await http.get(f"{BASE}{UPCOMING}", headers=credit_headers())
        if res.status_code != 200:
            raise SystemExit(f"upcoming {res.status_code}: {res.text[:400]}")
        print(res.text)


async def upcoming_inspect_or_pay() -> None:
    url = f"{BASE}{UPCOMING}"
    async with httpx.AsyncClient(timeout=30) as http:
        pre = await http.get(url)
        if pre.status_code == 200:
            print(pre.text)
            return
        if pre.status_code != 402:
            raise SystemExit(f"expected 402 or 200, got {pre.status_code}")
        accepted = assert_drop_terms(decode_payment_required(pre.headers))
        print(
            "402 terms OK:",
            {
                "amount": accepted["amount"],
                "network": accepted["network"],
                "payTo": accepted["payTo"],
                "asset": accepted["asset"],
            },
            file=sys.stderr,
        )
        if os.environ.get("UKDF_DRY_RUN") == "1":
            print("UKDF_DRY_RUN=1 — not paying.", file=sys.stderr)
            return

    key = os.environ.get("EVM_PRIVATE_KEY")
    if not key:
        raise SystemExit(
            "Set UKDF_TRIAL_KEY or UKDF_CREDIT_TOKEN, or EVM_PRIVATE_KEY to pay, or UKDF_DRY_RUN=1 to inspect only."
        )

    from eth_account import Account
    from x402 import x402Client
    from x402.http import x402HTTPClient
    from x402.http.clients import x402HttpxClient
    from x402.mechanisms.evm import EthAccountSigner
    from x402.mechanisms.evm.exact.register import register_exact_evm_client

    client = x402Client()
    account = Account.from_key(key)
    register_exact_evm_client(client, EthAccountSigner(account))
    http_client = x402HTTPClient(client)

    async with x402HttpxClient(client) as http:
        response = await http.get(url)
        await response.aread()
        print(response.text)
        if response.is_success:
            settle_response = http_client.get_payment_settle_response(
                lambda name: response.headers.get(name)
            )
            print("Payment settled:", settle_response, file=sys.stderr)


async def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "teaser"
    if cmd == "teaser":
        await teaser()
    elif cmd == "upcoming":
        if os.environ.get("UKDF_TRIAL_KEY") or os.environ.get("UKDF_CREDIT_TOKEN"):
            await upcoming_with_token()
        else:
            await upcoming_inspect_or_pay()
    else:
        raise SystemExit("Usage: python client.py [teaser|upcoming]")


if __name__ == "__main__":
    asyncio.run(main())
