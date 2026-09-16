# Private licensed history boundary

This directory is a placeholder only. Raw licensed TWSE/TPEx historical market data must **not** be committed to this public repository.

Production holding/exit validation uses a private licensed-history bundle created by `stock-lab/import-licensed-history.py`. The importer requires explicit rights for automated processing, derived outputs and local storage, validates provenance/checksums, rejects missing or impossible OHLC, and never imputes missing observations.

Allowed in the public repository:
- importer / validator code;
- schema and source registry;
- SHA-256 / provenance metadata that does not expose licensed raw rows;
- aggregate OOS/readiness results that contain no licensed row-level data.

Not allowed in the public repository:
- licensed raw or row-level historical data;
- reconstructed/proxy-filled historical rows;
- data obtained by scraping in place of a licence;
- data whose external/derived-use rights are not explicit.

Activation path: obtain an explicitly licensed TWSE/TPEx historical bundle, validate it privately, run the production-equivalent holding-exit OOS workflow privately, then publish only the non-raw validation summary. OGDL daily archives remain a forward-only fallback and are never used to invent unavailable history.
