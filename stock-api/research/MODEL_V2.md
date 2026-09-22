# Stock Price Model v2 — Evidence & Validation Specification

Status: research / not yet approved for production decisions

## 1. Goal

Generate support/resistance zones and decision-relevant price levels only when the rule has passed Taiwan-equity out-of-sample validation.

No model may publish a "confidence score" that is merely a hand-weighted heuristic.

## 2. Research basis

### A. Non-parametric pattern extraction
Reference: Lo, Mamaysky & Wang (2000), Journal of Finance.
Use non-parametric smoothing / local extrema detection to convert visually subjective price patterns into reproducible numerical features.

### B. Support / resistance event testing
Reference: Osler (2000), Federal Reserve Bank of New York; Osler (2003), Journal of Finance.
Treat a candidate support/resistance level as an event and measure whether price reversal / continuation rates differ materially from baseline.
Evidence is from FX markets, therefore it is a methodological precedent, not direct validation for Taiwan equities.

### C. Moving-average and trading-range rules
Reference: Brock, Lakonishok & LeBaron (1992), Journal of Finance.
MA and trading-range break rules are eligible as candidate features, not assumed truths.

### D. Data-snooping control
Reference: Sullivan, Timmermann & White (1999), Journal of Finance.
Any search across many rule variants must adjust for data-snooping / multiple-testing bias using a Reality-Check-style bootstrap or equivalent false-discovery control.

## 3. Taiwan equity validation design

Universe:
- TWSE common stocks
- TPEx common stocks
- exclude ETF / ETN / warrants / bonds
- require enough trading history for the selected horizon

Data:
- daily OHLCV
- no forward-filled missing prices
- corporate-action handling documented
- transaction costs included in trading-rule evaluation

Walk-forward:
- train window: historical window only
- validation window: later period
- test window: strictly later unseen period
- roll forward chronologically
- no random train/test shuffle

Market regimes:
- broad uptrend
- broad downtrend
- sideways / high-volatility periods
Report results separately by regime.

## 4. Candidate zone model

A candidate price zone must be built from reproducible density / turning-point evidence, not chain clustering.

Candidate features:
- kernel-smoothed turning-point density
- local swing extrema
- volume-at-price density where reliable volume data is available
- MA / trading-range features only as secondary features

Zone width:
- estimated from density bandwidth and empirical dispersion
- hard cap relative to volatility
- one zone cannot grow by single-link chaining across distant levels

## 5. Outcome definitions

For each candidate support zone, evaluate:
- entered zone?
- 5 / 10 / 20 trading-day forward return
- reversal magnitude
- maximum adverse excursion
- break-through rate
- time to break
- return after confirmed break

For resistance zones use the symmetric definitions.

## 6. Benchmarks

Every candidate model must beat at least:
- random zones matched by distance-to-price
- simple recent-low / recent-high benchmark
- MA-only benchmark
- naive ATR-band benchmark

## 7. Credibility metrics shown to users

Never show an arbitrary 0–100 score.

Show:
- Out-of-sample sample count (N)
- hit / reversal rate
- baseline rate
- uplift vs baseline
- 95% confidence interval
- test period
- market coverage
- transaction-cost assumption where relevant
- regime stability
- model version

Evidence grade:
- A: statistically and economically meaningful out-of-sample effect; stable across regimes; N >= 1000
- B: positive out-of-sample effect with acceptable stability; N >= 500
- C: limited / regime-sensitive evidence; N >= 200
- Research only: insufficient sample, unstable effect, or not yet independently validated

The grade is rule-based from the reported metrics. It is not a subjective score.

## 8. Production gate

A model may generate public buy/sell zones only when:
1. no look-ahead leakage
2. out-of-sample validation passed
3. benchmark comparison passed
4. data-snooping control documented
5. minimum sample size met
6. all coefficients / bandwidth choices are reproducible
7. current production model version is visible to the user

Until this gate is passed, the website must label outputs as "research only" and must not present heuristic zones as validated price recommendations.
