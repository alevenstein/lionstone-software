---
title: "Stonefall"
tagline: "A meditative falling-block puzzler with weight and consequence."
summary: "Stones cascade, settle, and shift the board. A slow, tactile puzzle game that rewards reading the field over twitch reflexes."
platforms: ["web", "android"]
status: "live"
year: 2024
featured: true
order: 20
heroImage: "/blog-placeholder-2.jpg"
links:
  play: "https://example.com/stonefall"
  playStore: "https://play.google.com/store/apps/details?id=com.example.stonefall"
---

## Overview

*Stonefall* started as a weekend prototype and grew into a full release. Stones don't snap to a grid — they tumble and rest where physics takes them, so every clear feels earned.

## Highlights

- **Physics-driven board.** No two configurations resolve the same way.
- **Daily challenge.** A new seeded board every day, leaderboard-ranked.
- **Quiet aesthetic.** Hand-tuned color palettes, minimal UI, ambient soundtrack.

## Tech

Web build runs on a WebGL renderer with a custom rigid-body solver. Android wraps the same engine in a thin native shell for input and lifecycle handling.
