# Dashboard rebuilt on a third-party admin template instead of restoring the original UI

Date: 2026-09-16 · Status: accepted (spec #15, tickets #16-#21)

## Context

The original dashboard (deleted in 25d0f77) was fully functional but visually unpolished.
The team lead rejected restoring it as-was. C3 (20% of the preliminary mark) judges explore
the dashboard live, so perceived quality matters. Three candidates were investigated:
buildermethods/build-new (Rails/Inertia — cannot run on Vercel, wrong tool), the MotherDuck
Next.js quickstart (fails its build without an external MotherDuck API token — violates the
no-inaccessible-dependency rule), and arhamkhnz/next-shadcn-admin-dashboard.

## Decision

Rebuild the dashboard on the shadcn admin template (MIT, Next.js + React + Tailwind v4 +
recharts): it builds clean with zero credentials, deploys to Vercel as-is, needs no database
or API keys, and reads only the synced data bundle. The original app's framework-agnostic
logic modules were ported (updated to schema 1.1.0); its UI was not restored. Charts use
recharts (the template's library); the source-market map is a deterministic precomputed SVG
from the local world.json — no ECharts, no CDN.

## Consequences

- Both pre-existing red tests turned green at ticket #16 and stayed green through #17-#21.
- Judgement-call code smells from three review rounds were consolidated into cleanup ticket #21.
- Screenshots are captured from the deployed site so the report matches what judges see.
