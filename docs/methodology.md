# Vigoros Scoring Methodology

**Version 1.0.0** · Effective 2026-09-18 · Status: draft for review

This document is the product. Every score Vigoros publishes is produced by the rules below and carries the version number that produced it. Changes are versioned, announced, and applied retroactively with the previous result kept visible. Nothing here is changed silently.

## 1. Principles

1. **Only the future counts.** Every forecast is sealed before its deadline and scored only against outcomes that occur afterwards. No historical data is ever scored.
2. **Score the forecast, not the equity curve.** A participant is a stream of probabilities. Position sizing, leverage and execution are out of scope.
3. **Skill is improvement over a dumb prior.** Getting 62% of up-days right is not skill. Beating the base rate for that question, on that asset, over that horizon, is.
4. **Proper scoring rules only.** The scoring rule must be one where the participant's best strategy is to report their true belief. Brier and logarithmic scores are both proper. Hit rate is not.
5. **Honest uncertainty.** Forecasts on the same day share shocks and are not independent. Every score is reported with an interval that accounts for that.
6. **Whole record or nothing.** A published record includes every resolved commitment ever made under that identity. Slices are not a thing.

## 2. Universe and venues

The universe is a versioned list of assets, each belonging to one venue. Venues define the trading calendar, the reference price time, and the commit deadline. Version 1 covers:

| Venue | Assets | Reference price | Deadline (day D) |
| --- | --- | --- | --- |
| US equities (NYSE, Nasdaq) | S&P 500 constituents plus SPY, QQQ, IWM | Official close, dividend and split adjusted | 13:00 UTC |
| UK equities (LSE) | FTSE 100 constituents plus ISF | Official close, adjusted | 07:30 UTC |
| FX | G10 majors against USD | 21:00 UTC mid | 07:00 UTC |
| Crypto | BTC, ETH, SOL | 00:00 UTC | 00:00 UTC |

Every deadline falls before that venue opens on day D. Questions for day D are generated from the close of the previous trading day, D−1. Universe membership changes are versioned; a question is always scored against the universe version it was issued under.

## 3. Questions

Each trading day D, Vigoros generates a deterministic question set from prices at D−1. The generator is open source and seeded, so anyone can regenerate the set and verify it.

Every asset in the universe receives exactly three questions per day, one of each type below. The horizon, and for level questions the k value, are drawn per asset by a pseudo-random generator seeded from the published daily seed, the issue date and the symbol. The draw is therefore stable and reproducible, but cannot be anticipated before the seed is published. Version 1 issues roughly 1,900 questions per day.

Three question types, three horizons (5, 10 and 21 trading days):

**Level.** Will the adjusted close on resolution day exceed threshold K? K is set at the D−1 close multiplied by (1 + k·σ), where σ is the trailing 21-day realised daily volatility scaled by √h, and k ∈ {−1, 0, +1}. The three k values give base rates near 16%, 50% and 84%, which exercises calibration across the range.

**Relative.** Will the asset's total return over the horizon exceed the median return of its peer group? Peer group is the sector for equities, the full venue set for FX and crypto. Base rate 50%.

**Quintile.** Will the asset's total return over the horizon rank in the top quintile of its venue universe? Base rate 20%.

Each question carries: a ULID, the issue date, the asset, the type, the horizon, the threshold where relevant, the deadline, the resolution date, and the prior (section 5). The resolution date for horizon h is the h-th trading day of the venue counting from D, with D itself as day one when the venue trades on D.

**Resolution** uses only the reference prices defined in section 2, dividend and split adjusted at both ends. A level question resolves by comparing the adjusted return from D−1 to the resolution date with the threshold return, so a corporate action between the two dates cannot flip an outcome. Relative and quintile questions rank the asset's adjusted return against every universe asset in the same venue at issue, whether or not that asset had a question. A question resolves to 1 or 0. If the asset is delisted, halted through the resolution date, or the reference price is unavailable, the question is voided and excluded from all scoring. Voids are logged publicly.

## 4. Commitments

A commitment is one probability for one question from one participant.

```json
{
  "question_id": "01J8...",
  "participant_id": "01J8...",
  "p": 0.71,
  "reasoning": "Post-earnings drift; options skew bid; sector breadth positive.",
  "falsifier": "Fails if the 10-day realised vol prints above 45.",
  "submitted_at": "2026-09-18T11:42:07.113Z"
}
```

- `p` is clipped to [0.01, 0.99] so that the logarithmic score is finite. The clipped value is what is scored.
- `reasoning` and `falsifier` are optional free text, at most 2,000 characters each.
- A commitment is final. There are no revisions in version 1. A second submission for the same question is rejected.
- Commitments after the deadline are rejected at the API, with the server timestamp as the authority.

**Sealing.** The canonical JSON of the commitment (RFC 8785) is hashed with SHA-256. Each day, the hashes of all commitments sealed that day are placed in a Merkle tree and the root is anchored to the Bitcoin blockchain through OpenTimestamps. Each participant receives their leaf hash and inclusion proof immediately. Anyone can verify, without trusting Vigoros, that a commitment existed before the anchor time.

**Reveal.** Probability, reasoning and falsifier are hidden from everyone, including Vigoros's public surfaces, until the question resolves. At resolution they are revealed and attached to the record.

## 5. The prior

Every question has a prior probability `q`, fixed at issue and published with the question. The prior is deliberately dumb. It encodes nothing but the base rate for that question type.

| Type | Prior |
| --- | --- |
| Level, k = 0 | Empirical frequency of a positive h-day return for that asset class over the trailing 504 trading days |
| Level, k = ±1 | Empirical frequency of an h-day return exceeding ±σ√h for that asset class over the trailing 504 trading days |
| Relative | 0.50 |
| Quintile | 0.20 |

Priors are computed per asset class, not per asset, so that they cannot leak asset-specific information. The empirical cells are recomputed on the first trading day of each month over the trailing 504 trading days and held fixed for the month. The prior table in force is published with every question set, together with the number of observations behind each cell.

## 6. Scoring a single commitment

For outcome `y ∈ {0, 1}`, probability `p`, prior `q`:

- Brier score: `BS(p) = (p − y)²`
- Logarithmic score: `LS(p) = −ln(p)` if `y = 1`, `−ln(1 − p)` if `y = 0`
- Brier skill on this question: `s = BS(q) − BS(p)`. Positive means the participant beat the prior.
- Log skill on this question: `ℓ = LS(q) − LS(p)`. This is the log-likelihood ratio of the participant's forecast against the prior, in nats. Summed over a record, it is the total weight of evidence that the participant knows something the prior does not.

Both are proper. Brier is bounded and the headline. Log is unbounded and reported alongside because it punishes overconfidence more severely.

## 7. Scoring a record

A record is the set of resolved, non-void commitments under one participant identity.

**Headline: Brier Skill Score.**

`BSS = 1 − Σ BS(p_i) / Σ BS(q_i)`

BSS is 0 for a participant who exactly matches the prior, positive for skill, negative for worse than the prior. It is computed only on questions the participant answered, against the prior on those same questions. Choosing questions therefore cannot manufacture skill: a participant who answers only the questions where they have real information is doing exactly what the score rewards.

**Total evidence.** `E = Σ ℓ_i` in nats, reported alongside BSS.

**Interval.** Commitments issued on the same day, and on overlapping horizons, share market shocks. Vigoros reports a 90% interval for BSS from a moving-block bootstrap over issue dates, with block length equal to the longest horizon (21 trading days), 2,000 resamples. The interval is always shown next to the score and is never omitted.

**Minimum record.** No score is displayed until a participant has at least 100 resolved commitments spanning at least 20 distinct issue dates. Before that the record page shows the count and the date the threshold will be met.

**Calibration.** Forecasts are binned into ten equal-width probability bins. For each bin, the mean forecast and the observed frequency are reported as a reliability diagram. Summary statistics:
- Expected Calibration Error: coverage-weighted mean absolute gap between forecast and observed frequency across bins.
- Murphy decomposition of the mean Brier score into reliability, resolution and uncertainty. Resolution is the part of the score that reflects genuine discrimination and is reported on its own.

**Breadth.** Distinct assets answered, distinct question types, coverage fraction of the issued set, and effective sample size after accounting for within-day correlation.

**Decay.** BSS by horizon bucket, and rolling 63-trading-day BSS over the life of the record. A participant whose edge exists only at 5 days is different from one whose edge holds at 21, and the record says so.

## 8. Ranking and percentiles

The public board ranks participants who meet the minimum record by BSS lower interval bound, not by point estimate. This rewards long, consistent records over short, lucky ones.

**Identity adjustment.** Every participant identity belongs to one verified publisher. A publisher may run many identities. Every identity is scored whether or not it is published. When a publisher publishes an identity, its displayed percentile is adjusted for the number of identities that publisher has run in the same period: the one-sided p-value that BSS > 0 is multiplied by that count (Bonferroni), and the adjusted value is what the board shows. Running fifty agents and publishing the survivor produces a visibly weak adjusted percentile, not a clean record.

## 9. Reference participants

Vigoros operates reference identities so that the board is never empty and every entrant has a benchmark. They are scored under exactly the same rules.

**Frontier models.** Each model receives the day's question set with a fixed, published prompt at temperature 0, and must return a probability for every question before the deadline. Prompt, model version and any change to either are logged publicly.

**Baselines.**
- Prior: `p = q` on every question. BSS is 0 by construction. This is the zero line.
- Momentum: `p = q + 0.05` if the trailing 63-day return is positive, `q − 0.05` otherwise.
- Mean reversion: the opposite sign.
- Random: `p` drawn uniformly from [0.30, 0.70], seeded and published.

## 10. Versioning and recomputation

Every score row carries the methodology version. When a new version is published:

1. The change and its rationale are posted publicly at least 14 days before it takes effect.
2. All historical records are recomputed under the new version.
3. Record pages show both the current and previous version's results for 90 days.
4. Sealed commitments are never altered. Only derived scores change.

Patch versions (1.0.x) fix computational defects and do not change definitions. Minor versions (1.x.0) add metrics without changing existing ones. Major versions change definitions.

## 11. What is not scored

- Anything about the past. No backtests, ever.
- Position size, P&L, leverage, execution.
- Forecasts after the deadline.
- Voided questions.
- Anything not committed through the sealed endpoint.

## 12. Known limitations, stated plainly

- Cross-sectional forecasts are correlated. The bootstrap interval addresses this but the effective sample is far below the raw count. A defensible skill estimate for a daily full-coverage participant takes roughly 12 to 18 months, not 6.
- The prior is per asset class and deliberately ignorant. A participant can beat it with public information such as earnings dates. That is skill relative to ignorance, not relative to the market. Version 2 will add an options-implied prior for US equities where liquid options exist.
- Version 1 has no revisions, so conviction under drawdown and revision hygiene are not yet measured. They require a revision protocol that preserves the original commitment, which is planned for version 1.1.
- Reasoning text is captured but not scored in version 1. Mechanism classification is an attribution feature, never a scoring input.
