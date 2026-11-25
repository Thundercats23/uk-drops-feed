from __future__ import annotations

import base64
import json
import sys
import types

import httpx
import pytest

from uk_drops_feed import UKDropsFeedClient, UkDropsFeedError


def test_teaser_and_auto_trial_ref() -> None:
    seen: list[tuple[str, str, dict[str, str]]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.method, str(request.url), dict(request.headers)))
        if request.url.path == "/v1/teaser":
            return httpx.Response(200, json={"drops": [{"id": "a"}]})
        if request.url.path == "/v1/trial-key":
            return httpx.Response(
                200,
                json={
                    "token": "tr_py_123",
                    "remaining": 10,
                    "pack": 10,
                    "issued_at": "2026-11-25T00:00:00Z",
                    "ref": request.url.params.get("ref"),
                },
            )
        if request.url.path == "/v1/drops/upcoming":
            return httpx.Response(200, json={"count": 1, "drops": [{"id": "a"}]})
        return httpx.Response(404, json={"error": "not found"})

    http = httpx.Client(transport=httpx.MockTransport(handler))
    client = UKDropsFeedClient(auto_trial=True, trial_ref="pytest", http_client=http)
    assert len(client.teaser("UK")["drops"]) == 1
    up = client.upcoming(franchise="pokemon-tcg", days=30, limit=5)
    assert up["count"] == 1
    assert client.trial_key == "tr_py_123"
    assert any("ref=pytest" in url for _, url, _ in seen)
    up_call = [h for _, u, h in seen if "/v1/drops/upcoming" in u][0]
    assert up_call["x-trial-key"] == "tr_py_123"


def test_rejects_bad_402_pay_to() -> None:
    payload = base64.b64encode(
        json.dumps(
            {
                "accepts": [
                    {
                        "amount": "10000",
                        "network": "eip155:8453",
                        "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                        "payTo": "0x0000000000000000000000000000000000000001",
                    }
                ]
            }
        ).encode()
    ).decode()
    http = httpx.Client(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(402, headers={"payment-required": payload}, json={})
        )
    )
    client = UKDropsFeedClient(
        evm_private_key="0x" + "11" * 32,
        http_client=http,
    )
    with pytest.raises(UkDropsFeedError, match="payTo"):
        client.upcoming()


def test_framework_wrappers_smoke(monkeypatch: pytest.MonkeyPatch) -> None:
    http = httpx.Client(
        transport=httpx.MockTransport(
            lambda req: httpx.Response(200, json={"path": req.url.path})
        )
    )
    client = UKDropsFeedClient(trial_key="tr_abc", http_client=http)

    # Stub optional peer modules so wrapper structure can be verified without heavy installs
    lc_mod = types.ModuleType("langchain_core.tools")

    class FakeStructuredTool:
        def __init__(self, **kw: object) -> None:
            self.__dict__.update(kw)

        @classmethod
        def from_function(cls, **kw: object) -> FakeStructuredTool:
            return cls(**kw)

    lc_mod.StructuredTool = FakeStructuredTool  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "langchain_core", types.ModuleType("langchain_core"))
    monkeypatch.setitem(sys.modules, "langchain_core.tools", lc_mod)

    from uk_drops_feed.langchain import get_langchain_tools

    lc_tools = get_langchain_tools(client)
    assert len(lc_tools) == 6
    assert json.loads(lc_tools[0].func(region="UK"))["path"] == "/v1/teaser"

    crew_tools_mod = types.ModuleType("crewai.tools")

    class FakeBaseTool:
        def __init__(self, **kw: object) -> None:
            for k, v in kw.items():
                setattr(self, k, v)

    crew_tools_mod.BaseTool = FakeBaseTool  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "crewai", types.ModuleType("crewai"))
    monkeypatch.setitem(sys.modules, "crewai.tools", crew_tools_mod)

    from uk_drops_feed.crewai import get_crewai_tools

    c_tools = get_crewai_tools(client)
    assert len(c_tools) == 4
    assert json.loads(c_tools[1]._run(region="UK"))["path"] == "/v1/drops/upcoming"

    agents_mod = types.ModuleType("agents")
    agents_mod.function_tool = lambda fn: fn  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "agents", agents_mod)

    from uk_drops_feed.openai_agents import get_openai_agents_tools

    oa_tools = get_openai_agents_tools(client)
    assert len(oa_tools) == 4
    assert json.loads(oa_tools[2](region="UK"))["path"] == "/v1/drops/restocks"
