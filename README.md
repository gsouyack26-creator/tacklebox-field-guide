# Tacklebox Field Guide

A phone-first, offline-capable U.S. freshwater and saltwater fishing reference. It covers 18 technique families with practical rod, reel, line, leader, bait/lure, seasonal, access, and safety guidance.

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

- Freshwater, saltwater, season, access, technique, and text filters
- Saved field cards stored on the phone
- Side-by-side comparison of up to three techniques
- Sunlight/high-contrast mode for outdoor visibility
- Installable PWA with an offline app shell
- Responsive layout, large touch targets, and no external runtime dependencies

## GitHub Pages deployment

Every push to `main` runs the tests and browser builds, then deploys the repository with `.github/workflows/pages.yml`.

## Local validation

```text
bun test tests/data.test.js
bun build app.js --target browser --outfile app-check.js
bun build data.js --target browser --outfile data-check.js
bun build sw.js --target browser --outfile sw-check.js
```

## Scope

This is a U.S.-general planning guide, not a substitute for local regulations, current weather/marine forecasts, qualified instruction, or manufacturer limits. Verify licenses, seasons, closures, size/bag limits, hook and bait restrictions, lead rules, and safety requirements before fishing.
