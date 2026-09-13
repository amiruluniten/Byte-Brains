# Web dashboard on Vercel, not Power BI

Datathon rules accept a .pbix dashboard or an approved online link. The team has no
Power BI Desktop access and the dashboard is agent-built (AI-developed), so we build a
Next.js + TypeScript dashboard (ECharts) deployed to Vercel's free tier and submit it as
an online link. A backend, database, or auth is deliberately excluded — the dashboard must
survive untouched through judging.

## Considered Options

- **Power BI (.pbix)**: judge-familiar default, rejected — no team access to Power BI Desktop.
- **Interactive Excel (.xlsm)**: rejected — too weak for maps, sliders, and a live scenario engine.
- **Streamlit**: rejected — Python server hosting is less stable for a competition-critical link.

## Consequences

- All data must ship as static JSON produced by the Python pipeline.
- The dashboard must be verified reachable before submission and kept deployed until judging ends.
