# Stock research evidence ledger

Updated: 2026-09-27

## Evidence rules
- VERIFIED: reproducible run exists, protocol and result are logged.
- PRELIMINARY: positive result without clean independent replication.
- FAILED: replication or stress test did not support the rule.
- UNVERIFIED: not yet tested with an auditable historical dataset.
- Never call a stock sample "independent" unless overlap is explicitly measured against a preserved master sample registry and equals 0.

## Current supported findings

### MOM6 cross-sectional ranking
Status: VERIFIED AS A CANDIDATE FILTER, NOT A TRADING RULE.
Latest locked audit cohort run: GitHub Actions 36309119681.
14 non-overlapping dates, future 84 trading days, +20% winner definition.
MOM6 top 20%:
- mean winner precision: 23.95%
- mean lift vs sampled universe: +6.67 percentage points
- positive periods: 10/14
- permutation p: 0.0131
- bootstrap 95% CI for lift: +1.66 to +12.95 pp
Caveat: this run was NOT cleanly independent from every prior study because the historical master exclusion registry was not preserved.

### Revenue acceleration after MOM6
Status: FAILED LATEST LOCKED REPLICATION.
Same run 36309119681.
Revenue-acceleration top 33% within MOM6 top 20%:
- mean winner precision: 24.22%
- incremental lift vs MOM6: +0.27 pp
- positive periods: 6/14
- permutation p: 0.464
- bootstrap 95% CI: -5.70 to +6.04 pp
Conclusion: do not use revenue acceleration as a validated second-stage probability booster.

### Margin inflection after revenue acceleration
Status: FAILED TO REPLICATE.
Run 36282910794.
Two independent cohorts in that run produced inconsistent signs/effects. Do not use margin inflection as a validated compression rule.

### Event / expectation-difference layer
Status: UNVERIFIED.
MOPS bulk historical major-information retrieval attempt was blocked by site security.
TWSE OpenAPI endpoint names were identified, but historical event reconstruction was not completed.
No historical event-layer backtest exists yet.
Do not describe any 10-stock list produced from manual event review as validated.

## Invalidated / withdrawn claims
- "10-stock validated shortlist": withdrawn.
- "Revenue acceleration is validated": withdrawn after run 36309119681.
- "Clean independent replication" for run 36309119681: withdrawn because the repository checkout did not contain the earlier research scripts needed to construct the exclusion registry; audit run 36309318223 found only 2 JS files and 0 prior codes.

## Current honest state
The only repeatably useful quantitative signal retained is MOM6 as a broad candidate filter.
No validated method currently compresses the Taiwan market to ~10 stocks while preserving or improving winner probability.
