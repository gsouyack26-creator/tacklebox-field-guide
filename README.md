# Striper Tacklebox | NJ Coastal Field Guide

A phone-first, offline-capable New Jersey striped bass, fluke, and sheepshead shore playbook backed by a U.S. freshwater and saltwater fishing reference. It covers 18 technique families with practical rod, reel, line, leader, bait/lure, seasonal, access, and safety guidance.

## Live app

https://gsouyack26-creator.github.io/tacklebox-field-guide/

The first online visit caches the guide. Reopen it later from the home screen when cell service is poor or unavailable.

## Install on a phone

### iPhone or iPad

1. Open the live URL in **Safari**.
2. Tap **Share**.
3. Choose **Add to Home Screen**, then **Add**.
4. Launch **Tacklebox** from the new home-screen icon once while online.

### Android

1. Open the live URL in **Chrome**.
2. Open the browser menu.
3. Choose **Install app** or **Add to Home screen**.
4. Launch it once while online so the latest guide is cached.

Saved field cards stay on that browser/device. Clearing site data removes saved cards and the offline cache.

## Features

- Striper-heavy Northeast field manual with step-by-step casting, retrieval, bait presentation, and hooksets
- Illustrated rig and knot bench for surf, inlet, bay, and structure fishing
- Optional click-to-load YouTube knot tutorials using privacy-enhanced embeds; offline steps remain available
- Budget, Mid-tier, and High-tier rod/reel examples for every procedure, including Penn, Shimano, Daiwa, and Jigging World options
- Standalone Recommended Setups module showing which techniques each complete tackle system fits, plus verified Tsunami, St. Croix, Lamiglas, Ugly Stik, and Daiwa rod alternatives
- Public NJ hotspot area guide for striped bass, fluke, bluefish, and sheepshead
- NJ shore playbook for striped bass, fluke, bluefish, and sheepshead
- Species-specific selectors for current conditions, structure, bait, and presentation
- 2026 NJ regulatory summaries with live-source links
- Freshwater, saltwater, season, access, technique, and text filters
- Saved field cards stored on the phone
- Side-by-side comparison of up to three techniques
- Permanent high-contrast dark theme designed for low-light and nighttime fishing
- Installable PWA with an offline app shell
- Responsive layout, large touch targets, and no external runtime dependencies

## GitHub Pages deployment

Every push to `main` runs the tests and browser builds, then deploys the repository with `.github/workflows/pages.yml`.

## Local validation

```text
bun test tests
bun build app.js --target browser --outfile app-check.js
bun build data.js --target browser --outfile data-check.js
bun build sw.js --target browser --outfile sw-check.js
```

## Scope

Gear examples are illustrative only — not endorsements, not sponsored, and contain no affiliate or referral links. Verify current specs, price, availability, reel capacity, and balance with the manufacturer or a local tackle shop.

This is a U.S.-general planning guide, not a substitute for local regulations, current weather/marine forecasts, qualified instruction, or manufacturer limits. Verify licenses, seasons, closures, size/bag limits, hook and bait restrictions, lead rules, and safety requirements before fishing.
