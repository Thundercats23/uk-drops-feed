"""OpenAI Agents SDK (@function_tool) wrappers for UK Drops Feed."""

from __future__ import annotations

import json
from typing import Any

from agents import function_tool

from .client import UKDropsFeedClient


def get_openai_agents_tools(client: UKDropsFeedClient) -> list[Any]:
    """Return @function_tool functions ready for OpenAI Agents SDK `Agent(tools=...)`."""

    @function_tool
    def ukdf_teaser(region: str = "UK") -> str:
        """Free: next 3 upcoming collectibles and video game drops. Default region=UK; pass US, CA, AU, EU, JP, or all."""
        return json.dumps(client.teaser(region=region))

    @function_tool
    def ukdf_upcoming_drops(
        region: str = "UK",
        franchise: str | None = None,
        kind: str | None = None,
        channel: str | None = None,
        days: int = 60,
        limit: int = 25,
    ) -> str:
        """Get upcoming collectibles and video game drops with dates, RRP and cited links."""
        return json.dumps(
            client.upcoming(
                region=region,
                franchise=franchise,
                kind=kind,
                channel=channel,
                days=days,
                limit=limit,
            )
        )

    @function_tool
    def ukdf_restocks(
        region: str = "UK",
        franchise: str | None = None,
        channel: str | None = None,
    ) -> str:
        """Get recent restocks and in-stock/preorder items from permitted shops."""
        return json.dumps(
            client.restocks(region=region, franchise=franchise, channel=channel)
        )

    @function_tool
    def ukdf_tcg_calendar(
        region: str = "UK",
        franchise: str | None = None,
        days: int = 120,
    ) -> str:
        """Get official TCG set street dates and prereleases."""
        return json.dumps(
            client.calendar(region=region, franchise=franchise, days=days)
        )

    return [ukdf_teaser, ukdf_upcoming_drops, ukdf_restocks, ukdf_tcg_calendar]
