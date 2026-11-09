# HTR · Heavy transport route check

Check whether a **permitted heavy-transport route** is usable before departure. Upload a VEMAGS GPX (or a labelled sample), enter the approved vehicle, and get READY / VERIFY / HOLD against live Autobahn conditions.

This is a free-tier MVP. It is not a permit, not MDS, and not a substitute for dispatcher judgement.

## What it does

- Import the exact approved route (GPX) and vehicle dimensions
- Compare that corridor with current roadworks, closures, warnings, and a few simulated scenarios
- Save jobs in this browser and re-check them until the planned departure
- Export PDF / CSV for the current result

## Live sources (free, no keys)

| Source | Use |
| --- | --- |
| Autobahn GmbH API (`verkehr.autobahn.de`) | Roadworks, closures, warnings, lorry parking |
| MIA DATEX via Mobilithek / MobiData BW | Bundled snapshot (`public/data/mia-roadworks.json`); live DATEX fallback if that file is older than 8 hours |
| Baden-Württemberg BEMaS | State roadworks (informational; cannot HOLD a federal corridor) |

Bridge and clearance are **not** in those feeds. READY needs an explicit dispatcher tick.

## Verdict rules (unchanged)

- **HOLD** — confirmed mainline block on the permitted Autobahn (full closure, residual width/height/weight vs the vehicle) within **0.5 km** of the GPX
- **VERIFY** — uncertain items, nearby (0.5–1.5 km) issues, ramps/AS, opposite direction, long-running works, missing clearance
- **READY** — no HOLD, no unresolved VERIFY, and dispatcher-confirmed bridge/clearance

HOLD items cannot be acknowledged away. VERIFY items can be confirmed on site by a named dispatcher.

## Demo dashboard vs sample permits

The overview page has two modes:

- **Demo dashboard** — a fixed preview of monitoring with made-up routes and verdicts. Never live, never saved.
- **Try a sample permit** — real GPX files. Opening one runs a live Autobahn check that is saved to this browser’s history.

`public/test-permits/` holds the snapped GPX samples (Hamburg→Hannover A7, Bremen→Dortmund A1, Leipzig→Nürnberg A9, Duisburg→Köln A3, München→Stuttgart A8, Lübeck→Rostock A20, Hof→Bayreuth A9). Scenario cards on Route checks skip live feeds so READY / VERIFY / HOLD can be demoed. Tracks were pre-snapped with public OSRM. © OpenStreetMap contributors, ODbL.

## How to run

```bash
pnpm install
pnpm dev          # Vite on $PORT / 8443
pnpm typecheck
pnpm build
pnpm test:verdict
pnpm test:qa      # Playwright against a local preview of dist/
```

## Deploy (Vercel Hobby)

- Build: `pnpm build`
- Output: `dist`
- API routes in `api/` (Node ESM). Relative API imports use `.js`.
- No paid Vercel features, no API keys, no cron-based monitoring

## Limitations

- **MDS / marketplace** is out of scope. Data partners is a later-release page only.
- **Bridge and clearance** are a manual dispatcher verify.
- **Monitoring** runs only while this tab is open. Keep it open until departure.
- **MIA snapshot** is refreshed by GitHub Actions (`refresh-mia-roadworks.yml`, about every 6 hours; `workflow_dispatch` is also enabled). GitHub cron on a quiet repo can skip ticks. If the served snapshot is older than **8 hours**, `POST /api/check-route` fetches the MobiData BW DATEX feeds live (8s timeout, ~10 min in-memory cache). If that live refresh fails, the MIA layer is marked stale in the result instead of going silent.
- **Rate limiting** is best-effort only: an in-memory per-instance token bucket on each serverless isolate. It does not run at the edge and will not reliably return HTTP 429 on Vercel Hobby. Do not treat it as a hard API quota.
- **Free tier** — no email/SMS, jobs stored in this browser only.

## License

Prototype for dispatch support. Authority wording stays in German; the UI adds an English summary. Official permits remain authoritative.
