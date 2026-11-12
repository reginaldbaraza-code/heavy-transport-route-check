# Heavy Transport Route Check

React + Vite app for checking permitted heavy-transport routes against live Autobahn conditions.

## What it does

Check whether a permitted heavy-transport route (GPX from VEMAGS) is usable before departure. Upload the route, enter the approved vehicle, and get READY / VERIFY / HOLD verdicts against live roadworks, closures, and warnings from Autobahn GmbH and MIA DATEX feeds.

## Commands

```bash
pnpm install
pnpm dev          # Vite dev server
pnpm typecheck    # TypeScript check for src/ and api/
pnpm build        # Build to dist/
pnpm test:verdict # Run unit tests
pnpm test:qa      # Playwright E2E tests
```

## API routes

Vercel serverless functions in `api/` (Node ESM). The MIA roadworks snapshot (`public/data/mia-roadworks.json`) is refreshed by GitHub Actions every ~6 hours via `scripts/refresh-mia-roadworks.mjs`.

## Stack

- React 19, React Router 7, Vite 8, TypeScript 5.7
- Tailwind CSS v4 with `@tailwindcss/vite`
- MapLibre GL and Leaflet for mapping
- Turf.js for geospatial logic
- Deployed on Vercel (static + serverless functions)
