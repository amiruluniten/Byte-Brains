# Precomputed Python pipeline with a client-side scenario engine

We diagnose with ML in a Python pipeline (pandas/openpyxl over TSA and Tourism Malaysia
files, scikit-learn for source-market segmentation), emitting versioned JSON files that the
dashboard reads. The prescriptive "market mix" simulator runs live in the browser using
model coefficients exported from the pipeline, not on a server.

Complex ML stays offline where it belongs; the prescription is transparent arithmetic on
learned coefficients, which keeps the simulator instant, explainable to judges, and
impossible to break at demo time.

## Considered Options

- **Precomputed scenario set only**: safe but static; loses the interactive demo moment.
- **Server-side API (Vercel functions + Python)**: rejected — more moving parts than a
  competition-critical demo needs.
