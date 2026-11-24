# UK Drops Feed — Discord alert bot template

A small bot that polls the feed and posts **new** official dates or restocks into one channel. Designed for alert-bot builders who already have a Discord server.

This template uses a **trial or prepaid token**. Issue a trial key once with `POST /v1/trial-key` and set `UKDF_TRIAL_KEY` (sent as `X-Trial-Key`). After 10 calls, buy a 25-call pack (`POST /v1/credits/buy`, $0.20) and set `UKDF_CREDIT_TOKEN`. n8n, Make and most Discord hosts cannot hold a spending wallet safely; raw x402 payment is in `../js` if you need it.

## What it posts

Every poll it calls:

- `GET /v1/drops/upcoming?franchise=pokemon-tcg&days=30&limit=25&region=UK` (change filters in env)
- optionally `GET /v1/drops/restocks?franchise=pokemon-tcg`

It remembers seen drop ids in `./seen.json` and only posts new or changed items. Each embed includes product, region, date or window, and a cited link when the feed provides one. Footer: check the retailer before buying.

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `DISCORD_BOT_TOKEN` | Yes | Your bot token. **Never commit it.** |
| `DISCORD_CHANNEL_ID` | Yes | Channel to post in |
| `UKDF_TRIAL_KEY` | One of these | Free trial key from `POST /v1/trial-key` |
| `UKDF_CREDIT_TOKEN` | One of these | Prepaid pack token |
| `UKDF_REGION` | No | Default `UK`. Use `US`, `CA`, `all`, etc. |
| `UKDF_FRANCHISE` | No | Default `pokemon-tcg` |
| `UKDF_POLL_MINUTES` | No | Default `30` (each poll is one paid call per route) |
| `UKDF_INCLUDE_RESTOCKS` | No | Set `1` to also poll restocks (a second paid call) |

Cost: at 30-minute polls, upcoming only is 48 calls/day ≈ $0.48 at $0.01, or about two 25-call packs ($0.40). Add restocks and it doubles. Start slower.

## Setup

1. Create a Discord application and bot: https://discord.com/developers/applications
2. Invite the bot with `Send Messages` and `Embed Links` in one channel.
3. `npm install &&` set env vars, then `npm start`.

Do not scrape retailer sites from this bot. The feed already uses official or permitted sources only.
