---
title: "Defendor"
tagline: "A pocket-sized tower defense in the spirit of Onslaught 2."
summary: "Top-down tower defense with five tower types, ten themed levels, and 1,000 waves. Procedurally drawn, asset-free, and runs in any modern browser."
platforms: ["web", "android"]
status: "live"
year: 2025
featured: true
order: 5
heroImage: "/play/defendor/icon.svg"
links:
  play: "/games/defendor/"
---

## Overview

*Defendor* is a top-down tower defense game inspired by the (delisted) **Onslaught 2**. Stop alien waves from reaching your base on the right of a winding desert road. Each level is 100 waves; clear all 10 levels for 1,000 waves of escalating chaos.

## Highlights

- **Five towers, three upgrade tracks each.** Cannon, MG, Laser, Missile, Tesla — every tower has independent Damage / Rate / Range upgrades, with cheaper bonuses on its specialty track.
- **Ten unique levels.** Each with its own winding path and color theme; cash carries over plus a clear bonus.
- **Rush for risk-reward income.** Press Rush mid-wave to start the next wave early on top of the current one. The cash bonus scales with wave number.
- **Plays anywhere.** Web, Android browser, or wrap as a real APK with Capacitor. Optional PWA install for fullscreen, landscape-locked play.
- **Procedural everything.** No image files, no sound files. The whole game ships as text.

## Tech

Plain HTML, CSS, and ES modules. ~20 source files in `src/` — separation between data tables, simulation, rendering, and input. Engine-agnostic; runs identically on Chromium, Firefox, Safari, and Android WebView.
