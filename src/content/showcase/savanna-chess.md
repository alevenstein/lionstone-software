---
title: "Savanna Chess"
tagline: "Chess variants, fast pairings, and a friendly community."
summary: "A web-first chess platform built around variants — 960, three-check, atomic, antichess — with quick pairing and human-readable ratings."
platforms: ["web"]
status: "live"
year: 2024
order: 40
heroImage: "/blog-placeholder-4.jpg"
links:
  play: "https://example.com/savanna-chess"
  source: "https://github.com/example/savanna-chess"
---

## Overview

*Savanna Chess* is a small but opinionated chess platform. Pairings happen in seconds, ratings make sense at a glance, and variants are first-class citizens — not buried three menus deep.

## Highlights

- **Variant-first.** 960, three-check, atomic, antichess all on the front page.
- **No ads, no upsells.** Free to play, open-source server.
- **Readable ratings.** Glicko-2 scores rendered in plain language.

## Tech

Astro front end, a Rust matchmaking core, and a WebSocket layer that survives flaky mobile connections.
