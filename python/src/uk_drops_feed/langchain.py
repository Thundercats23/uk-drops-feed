"""LangChain tool wrappers for UK Drops Feed."""

from __future__ import annotations

import json
from typing import Literal

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from .client import UKDropsFeedClient


class TeaserInput(BaseModel):
    region: str = Field(
        default="UK",
        description="Market region code: UK (default), US, CA, AU, EU, JP, or all",
    )


class UpcomingInput(BaseModel):
    region: str = Field(default="UK", description="UK (default), US, CA, AU, EU, JP, or all")
    franchise: str | None = Field(
        default=None,
        description="Optional franchise: pokemon-tcg, mtg, one-piece, lorcana, yugioh, star-wars-unlimited, lego, video-game, retail-sale, jellycat, needoh",
    )
    kind: str | None = Field(
        default=None,
        description="Optional kind: release, retiring, sale-window, restock-watch, prerelease, organised-play",
    )
    channel: str | None = Field(
        default=None,
        description="Optional offer channel: preorder, raffle, queue, in-store-only, online, unconfirmed",
    )
    days: int = Field(default=60, ge=1, le=365)
    limit: int = Field(default=25, ge=1, le=200)


class CalendarInput(BaseModel):
    region: str = Field(default="UK", description="UK (default), US, CA, AU, EU, JP, or all")
    franchise: Literal[
        "pokemon-tcg", "mtg", "one-piece", "lorcana", "yugioh", "star-wars-unlimited"
    ] | None = Field(default=None)
    days: int = Field(default=120, ge=1, le=365)


class RestocksInput(BaseModel):
    region: str = Field(default="UK", description="UK (default), US, CA, or all")
    franchise: str | None = Field(default=None)
    channel: str | None = Field(default=None)
    since: str | None = Field(default=None, description="Optional ISO 8601 timestamp")


class StatusInput(BaseModel):
    ids: list[str] | None = Field(default=None, description="Optional list of drop IDs")
    region: str = Field(default="UK")
    franchise: str | None = Field(default=None)


class BriefInput(BaseModel):
    franchise: str | None = Field(default=None)
    week: str | None = Field(default=None, description="Optional YYYY-MM-DD inside target week")


def get_langchain_tools(client: UKDropsFeedClient) -> list[StructuredTool]:
    """Return LangChain StructuredTools backed by UKDropsFeedClient."""
    return [
        StructuredTool.from_function(
            func=lambda region="UK": json.dumps(client.teaser(region=region)),
            name="ukdf_teaser",
            description="Free: get the next 3 upcoming collectibles and video game drops (Pokemon TCG, MTG, LEGO, GTA 6). Default region=UK.",
            args_schema=TeaserInput,
        ),
        StructuredTool.from_function(
            func=lambda region="UK", franchise=None, kind=None, channel=None, days=60, limit=25: json.dumps(
                client.upcoming(
                    region=region,
                    franchise=franchise,
                    kind=kind,
                    channel=channel,
                    days=days,
                    limit=limit,
                )
            ),
            name="ukdf_upcoming_drops",
            description="Get upcoming collectibles and video game drops with dates, prices and cited links. Uses 1 trial/credit call or $0.01 x402.",
            args_schema=UpcomingInput,
        ),
        StructuredTool.from_function(
            func=lambda region="UK", franchise=None, days=120: json.dumps(
                client.calendar(region=region, franchise=franchise, days=days)
            ),
            name="ukdf_tcg_calendar",
            description="Get official TCG street dates (Pokemon, MTG, One Piece, Lorcana, Yu-Gi-Oh!, Star Wars: Unlimited). Uses 1 trial/credit call or $0.01 x402.",
            args_schema=CalendarInput,
        ),
        StructuredTool.from_function(
            func=lambda region="UK", franchise=None, channel=None, since=None: json.dumps(
                client.restocks(
                    region=region, franchise=franchise, channel=channel, since=since
                )
            ),
            name="ukdf_restocks",
            description="Get recent restocks and in-stock/preorder items from permitted shops. Uses 1 trial/credit call or $0.01 x402.",
            args_schema=RestocksInput,
        ),
        StructuredTool.from_function(
            func=lambda ids=None, region="UK", franchise=None: json.dumps(
                client.status(ids=ids, region=region, franchise=franchise)
            ),
            name="ukdf_stock_status",
            description="Get curated stock, preorder and purchase-limit status. Uses 1 trial/credit call or $0.01 x402.",
            args_schema=StatusInput,
        ),
        StructuredTool.from_function(
            func=lambda franchise=None, week=None: json.dumps(
                client.weekly_brief(franchise=franchise, week=week)
            ),
            name="ukdf_weekly_brief",
            description="Get the weekly official-source games and TCG brief with confirmed/rumoured flags. Uses 1 trial/credit call or $0.01 x402.",
            args_schema=BriefInput,
        ),
    ]
