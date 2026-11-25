"""CrewAI BaseTool wrappers for UK Drops Feed."""

from __future__ import annotations

import json
from typing import Any

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from .client import UKDropsFeedClient


class _TeaserArgs(BaseModel):
    region: str = Field(default="UK", description="UK (default), US, CA, AU, EU, JP, or all")


class _UpcomingArgs(BaseModel):
    region: str = Field(default="UK")
    franchise: str | None = Field(default=None)
    kind: str | None = Field(default=None)
    days: int = Field(default=60, ge=1, le=365)
    limit: int = Field(default=25, ge=1, le=200)


class _RestocksArgs(BaseModel):
    region: str = Field(default="UK")
    franchise: str | None = Field(default=None)
    channel: str | None = Field(default=None)


class _CalendarArgs(BaseModel):
    region: str = Field(default="UK")
    franchise: str | None = Field(default=None)
    days: int = Field(default=120, ge=1, le=365)


class UkdfTeaserTool(BaseTool):
    name: str = "ukdf_teaser"
    description: str = "Free: next 3 collectibles and video game drops (Pokemon TCG, MTG, LEGO, GTA 6). Default region=UK."
    args_schema: type[BaseModel] = _TeaserArgs
    client: Any

    def _run(self, region: str = "UK") -> str:
        return json.dumps(self.client.teaser(region=region))


class UkdfUpcomingTool(BaseTool):
    name: str = "ukdf_upcoming_drops"
    description: str = "Get upcoming TCG, LEGO and video game drops with dates, RRP and cited sources."
    args_schema: type[BaseModel] = _UpcomingArgs
    client: Any

    def _run(
        self,
        region: str = "UK",
        franchise: str | None = None,
        kind: str | None = None,
        days: int = 60,
        limit: int = 25,
    ) -> str:
        return json.dumps(
            self.client.upcoming(
                region=region, franchise=franchise, kind=kind, days=days, limit=limit
            )
        )


class UkdfRestocksTool(BaseTool):
    name: str = "ukdf_restocks"
    description: str = "Get recent restocks and in-stock/preorder items from permitted shops."
    args_schema: type[BaseModel] = _RestocksArgs
    client: Any

    def _run(
        self,
        region: str = "UK",
        franchise: str | None = None,
        channel: str | None = None,
    ) -> str:
        return json.dumps(
            self.client.restocks(region=region, franchise=franchise, channel=channel)
        )


class UkdfCalendarTool(BaseTool):
    name: str = "ukdf_tcg_calendar"
    description: str = "Get official TCG set street dates and prereleases."
    args_schema: type[BaseModel] = _CalendarArgs
    client: Any

    def _run(
        self,
        region: str = "UK",
        franchise: str | None = None,
        days: int = 120,
    ) -> str:
        return json.dumps(
            self.client.calendar(region=region, franchise=franchise, days=days)
        )


def get_crewai_tools(client: UKDropsFeedClient) -> list[BaseTool]:
    """Return CrewAI BaseTool instances backed by UKDropsFeedClient."""
    return [
        UkdfTeaserTool(client=client),
        UkdfUpcomingTool(client=client),
        UkdfRestocksTool(client=client),
        UkdfCalendarTool(client=client),
    ]
