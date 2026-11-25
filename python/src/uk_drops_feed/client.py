from __future__ import annotations

import base64
import json
from typing import Any
from urllib.parse import quote

import httpx

DEFAULT_BASE_URL = "https://uk-drops-feed.8bitbudgets.workers.dev"
EXPECTED_PAY_TO = "0xb3f6872E6ffeA3f8Da7a5d5EB52ed2a5e15D60AA".lower()
BASE_USDC_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".lower()
BASE_MAINNET_NETWORK = "eip155:8453"

FRANCHISES = (
    "pokemon-tcg",
    "mtg",
    "one-piece",
    "lorcana",
    "yugioh",
    "star-wars-unlimited",
    "lego",
    "video-game",
    "retail-sale",
    "jellycat",
    "needoh",
    "other",
)

DROP_KINDS = (
    "release",
    "retiring",
    "sale-window",
    "restock-watch",
    "reference",
    "prerelease",
    "organised-play",
)

OFFER_CHANNELS = (
    "preorder",
    "raffle",
    "queue",
    "in-store-only",
    "online",
    "unconfirmed",
)


class UkDropsFeedError(Exception):
    def __init__(self, message: str, status: int, body: Any = None) -> None:
        super().__init__(message)
        self.status = status
        self.body = body


def _clean_params(params: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in params.items() if v is not None and v != ""}


def _decode_payment_required(headers: httpx.Headers) -> dict[str, Any] | None:
    raw = headers.get("payment-required") or headers.get("PAYMENT-REQUIRED")
    if not raw:
        return None
    try:
        return json.loads(base64.b64decode(raw))
    except Exception:
        return None


def _validate_402(headers: httpx.Headers, max_atomic_amount: int) -> dict[str, Any]:
    req = _decode_payment_required(headers)
    accepts = (req or {}).get("accepts") or []
    if not accepts:
        raise UkDropsFeedError("402 response missing accepts[]", 402, req)
    accept = accepts[0]
    amount = int(str(accept.get("amount", "0")))
    if amount <= 0 or amount > max_atomic_amount:
        raise UkDropsFeedError(
            f"402 amount {amount} exceeds cap {max_atomic_amount}", 402, accept
        )
    if str(accept.get("network")) != BASE_MAINNET_NETWORK:
        raise UkDropsFeedError(
            f"Unexpected payment network {accept.get('network')}", 402, accept
        )
    if str(accept.get("asset", "")).lower() != BASE_USDC_ASSET:
        raise UkDropsFeedError(
            f"Unexpected payment asset {accept.get('asset')}", 402, accept
        )
    if str(accept.get("payTo", "")).lower() != EXPECTED_PAY_TO:
        raise UkDropsFeedError(
            f"Unexpected payTo address {accept.get('payTo')}", 402, accept
        )
    return accept


def _parse_response(res: httpx.Response, method: str, path: str) -> dict[str, Any]:
    text = res.text
    try:
        data: Any = res.json() if text else {}
    except Exception:
        data = text
    if not res.is_success:
        raise UkDropsFeedError(
            f"UK Drops Feed {method} {path} failed with {res.status_code}",
            res.status_code,
            data,
        )
    return data if isinstance(data, dict) else {"data": data}


class UKDropsFeedClient:
    """Synchronous client for UK Drops Feed."""

    def __init__(
        self,
        *,
        base_url: str = DEFAULT_BASE_URL,
        trial_key: str | None = None,
        credit_token: str | None = None,
        auto_trial: bool = False,
        trial_ref: str = "python-sdk",
        evm_private_key: str | None = None,
        max_atomic_amount: int = 200_000,
        timeout: float = 30.0,
        http_client: httpx.Client | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.trial_key = trial_key
        self.credit_token = credit_token
        self.auto_trial = auto_trial
        self.trial_ref = trial_ref
        self.evm_private_key = evm_private_key
        self.max_atomic_amount = max_atomic_amount
        self._owns_client = http_client is None
        self._http = http_client or httpx.Client(timeout=timeout)

    def close(self) -> None:
        if self._owns_client:
            self._http.close()

    def __enter__(self) -> UKDropsFeedClient:
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json_body: dict[str, Any] | None = None,
        payable: bool = False,
        supports_trial: bool = True,
    ) -> dict[str, Any]:
        headers: dict[str, str] = {}
        if supports_trial and self.trial_key:
            headers["Authorization"] = f"Bearer {self.trial_key}"
            headers["X-Trial-Key"] = self.trial_key
        elif supports_trial and self.credit_token:
            headers["Authorization"] = f"Bearer {self.credit_token}"
            headers["X-Credit-Token"] = self.credit_token
        elif payable and supports_trial and self.auto_trial and not self.evm_private_key:
            issued = self.mint_trial_key(self.trial_ref)
            self.trial_key = issued["token"]
            headers["Authorization"] = f"Bearer {self.trial_key}"
            headers["X-Trial-Key"] = self.trial_key

        url = f"{self.base_url}{path}"
        cleaned = _clean_params(params or {})
        res = self._http.request(
            method, url, params=cleaned or None, json=json_body, headers=headers
        )
        if res.status_code == 402 and payable and self.evm_private_key:
            _validate_402(res.headers, self.max_atomic_amount)
            return self._pay_with_x402_sync(method, str(res.request.url), json_body)
        return _parse_response(res, method, path)

    def _pay_with_x402_sync(
        self, method: str, url: str, json_body: dict[str, Any] | None
    ) -> dict[str, Any]:
        import asyncio
        from eth_account import Account
        from x402 import x402Client
        from x402.http.clients import x402HttpxClient
        from x402.mechanisms.evm import EthAccountSigner
        from x402.mechanisms.evm.exact.register import register_exact_evm_client

        async def _run() -> dict[str, Any]:
            client = x402Client()
            register_exact_evm_client(
                client, EthAccountSigner(Account.from_key(self.evm_private_key))
            )
            async with x402HttpxClient(client) as http:
                resp = await http.request(method, url, json=json_body)
                await resp.aread()
                return _parse_response(resp, method, url)

        return asyncio.run(_run())

    def teaser(self, region: str = "UK") -> dict[str, Any]:
        return self._request("GET", "/v1/teaser", params={"region": region})

    def sources(self) -> dict[str, Any]:
        return self._request("GET", "/v1/sources")

    def mint_trial_key(self, ref: str | None = None) -> dict[str, Any]:
        tag = self.trial_ref if ref is None else ref
        res = self._request(
            "POST",
            "/v1/trial-key",
            params={"ref": tag} if tag else None,
            supports_trial=False,
        )
        if "token" in res:
            self.trial_key = res["token"]
        return res

    def trial_balance(self) -> dict[str, Any]:
        if not self.trial_key:
            raise UkDropsFeedError("No trial_key configured", 401)
        return self._request("GET", "/v1/trial/balance")

    def credits_balance(self) -> dict[str, Any]:
        if not self.credit_token:
            raise UkDropsFeedError("No credit_token configured", 401)
        return self._request("GET", "/v1/credits/balance")

    def upcoming(
        self,
        *,
        region: str | None = None,
        franchise: str | None = None,
        kind: str | None = None,
        channel: str | None = None,
        set_name: str | None = None,
        days: int | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "GET",
            "/v1/drops/upcoming",
            params={
                "region": region,
                "franchise": franchise,
                "kind": kind,
                "channel": channel,
                "set": set_name,
                "days": days,
                "limit": limit,
            },
            payable=True,
        )

    def calendar(
        self,
        *,
        region: str | None = None,
        franchise: str | None = None,
        kind: str | None = None,
        set_name: str | None = None,
        days: int | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "GET",
            "/v1/drops/calendar",
            params={
                "region": region,
                "franchise": franchise,
                "kind": kind,
                "set": set_name,
                "days": days,
                "limit": limit,
            },
            payable=True,
        )

    def restocks(
        self,
        *,
        since: str | None = None,
        region: str | None = None,
        franchise: str | None = None,
        channel: str | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "GET",
            "/v1/drops/restocks",
            params={
                "since": since,
                "region": region,
                "franchise": franchise,
                "channel": channel,
            },
            payable=True,
        )

    def status(
        self,
        *,
        ids: list[str] | str | None = None,
        region: str | None = None,
        franchise: str | None = None,
    ) -> dict[str, Any]:
        ids_param = ",".join(ids) if isinstance(ids, list) else ids
        return self._request(
            "GET",
            "/v1/drops/status",
            params={"ids": ids_param, "region": region, "franchise": franchise},
            payable=True,
        )

    def item(self, drop_id: str) -> dict[str, Any]:
        return self._request(
            "GET", f"/v1/drops/item/{quote(drop_id, safe='')}", payable=True
        )

    def weekly_brief(
        self, *, franchise: str | None = None, week: str | None = None
    ) -> dict[str, Any]:
        return self._request(
            "GET",
            "/v1/briefs/weekly",
            params={"franchise": franchise, "week": week},
            payable=True,
        )

    def buy_credits(self) -> dict[str, Any]:
        return self._request(
            "POST", "/v1/credits/buy", payable=True, supports_trial=False
        )

    def ask(self, question: str) -> dict[str, Any]:
        return self._request(
            "POST",
            "/v1/ask",
            json_body={"question": question},
            payable=True,
            supports_trial=False,
        )

    def ask_status(self, ask_id: str) -> dict[str, Any]:
        return self._request(
            "GET", f"/v1/ask/{quote(ask_id, safe='')}", supports_trial=False
        )


class AsyncUKDropsFeedClient:
    """Asynchronous client for UK Drops Feed."""

    def __init__(
        self,
        *,
        base_url: str = DEFAULT_BASE_URL,
        trial_key: str | None = None,
        credit_token: str | None = None,
        auto_trial: bool = False,
        trial_ref: str = "python-sdk",
        evm_private_key: str | None = None,
        max_atomic_amount: int = 200_000,
        timeout: float = 30.0,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.trial_key = trial_key
        self.credit_token = credit_token
        self.auto_trial = auto_trial
        self.trial_ref = trial_ref
        self.evm_private_key = evm_private_key
        self.max_atomic_amount = max_atomic_amount
        self._owns_client = http_client is None
        self._http = http_client or httpx.AsyncClient(timeout=timeout)

    async def aclose(self) -> None:
        if self._owns_client:
            await self._http.aclose()

    async def __aenter__(self) -> AsyncUKDropsFeedClient:
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.aclose()

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json_body: dict[str, Any] | None = None,
        payable: bool = False,
        supports_trial: bool = True,
    ) -> dict[str, Any]:
        headers: dict[str, str] = {}
        if supports_trial and self.trial_key:
            headers["Authorization"] = f"Bearer {self.trial_key}"
            headers["X-Trial-Key"] = self.trial_key
        elif supports_trial and self.credit_token:
            headers["Authorization"] = f"Bearer {self.credit_token}"
            headers["X-Credit-Token"] = self.credit_token
        elif payable and supports_trial and self.auto_trial and not self.evm_private_key:
            issued = await self.mint_trial_key(self.trial_ref)
            self.trial_key = issued["token"]
            headers["Authorization"] = f"Bearer {self.trial_key}"
            headers["X-Trial-Key"] = self.trial_key

        url = f"{self.base_url}{path}"
        cleaned = _clean_params(params or {})
        res = await self._http.request(
            method, url, params=cleaned or None, json=json_body, headers=headers
        )
        if res.status_code == 402 and payable and self.evm_private_key:
            _validate_402(res.headers, self.max_atomic_amount)
            from eth_account import Account
            from x402 import x402Client
            from x402.http.clients import x402HttpxClient
            from x402.mechanisms.evm import EthAccountSigner
            from x402.mechanisms.evm.exact.register import register_exact_evm_client

            client = x402Client()
            register_exact_evm_client(
                client, EthAccountSigner(Account.from_key(self.evm_private_key))
            )
            async with x402HttpxClient(client) as http:
                resp = await http.request(method, str(res.request.url), json=json_body)
                await resp.aread()
                return _parse_response(resp, method, path)
        return _parse_response(res, method, path)

    async def teaser(self, region: str = "UK") -> dict[str, Any]:
        return await self._request("GET", "/v1/teaser", params={"region": region})

    async def mint_trial_key(self, ref: str | None = None) -> dict[str, Any]:
        tag = self.trial_ref if ref is None else ref
        res = await self._request(
            "POST",
            "/v1/trial-key",
            params={"ref": tag} if tag else None,
            supports_trial=False,
        )
        if "token" in res:
            self.trial_key = res["token"]
        return res

    async def upcoming(self, **kwargs: Any) -> dict[str, Any]:
        set_name = kwargs.pop("set_name", None)
        if set_name is not None:
            kwargs["set"] = set_name
        return await self._request(
            "GET", "/v1/drops/upcoming", params=kwargs, payable=True
        )

    async def restocks(self, **kwargs: Any) -> dict[str, Any]:
        return await self._request(
            "GET", "/v1/drops/restocks", params=kwargs, payable=True
        )

    async def calendar(self, **kwargs: Any) -> dict[str, Any]:
        set_name = kwargs.pop("set_name", None)
        if set_name is not None:
            kwargs["set"] = set_name
        return await self._request(
            "GET", "/v1/drops/calendar", params=kwargs, payable=True
        )

    async def status(self, **kwargs: Any) -> dict[str, Any]:
        if isinstance(kwargs.get("ids"), list):
            kwargs["ids"] = ",".join(kwargs["ids"])
        return await self._request(
            "GET", "/v1/drops/status", params=kwargs, payable=True
        )

    async def item(self, drop_id: str) -> dict[str, Any]:
        return await self._request(
            "GET", f"/v1/drops/item/{quote(drop_id, safe='')}", payable=True
        )

    async def weekly_brief(self, **kwargs: Any) -> dict[str, Any]:
        return await self._request(
            "GET", "/v1/briefs/weekly", params=kwargs, payable=True
        )
