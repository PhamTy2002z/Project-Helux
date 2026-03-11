# Research Summary

- OpenClaw provides per-session usage RPC (`sessions.usage*`).
- Mission Control currently not consuming these APIs.
- Existing quota read path uses static metadata counters, not runtime-derived usage.
- Enforcement target should be gateway dispatch/session send path.
- VN day reset feasible via OpenClaw `mode: specific`, `utcOffset: UTC+7`.
