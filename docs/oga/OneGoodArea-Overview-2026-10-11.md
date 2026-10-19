# OneGoodArea: what it is, where it stands, where it is going

*Written 11 October 2026. Everything here describes code on `main` (925036d4), production data read that day, the Jira board and the business documents in this folder, except where marked as planned. Supersedes `OneGoodArea-Overview-2026-09-20.md`, kept as history.*

---

## 1. In one paragraph

OneGoodArea is the intelligence layer for place: place intelligence infrastructure for property and location products. It turns every neighbourhood in Great Britain into sourced, dated, confidence-rated facts (crime, deprivation, property, schools, amenities, transport, environment), gives every place a permanent id that survives boundary changes, keeps a monthly history of every value, and sells access to all of it as an API in four composable products: **Signals** (the facts), **Scores** (a deterministic 0 to 100 composite for a stated purpose, ranked among similar places), **Monitor** (watch a portfolio of places and be told what changed and why), and **Intelligence** (a typed query plane, similar places, outliers and forecasts, with plain English as one input mode). Every value names its source and the period it describes, every response carries the methodology version that produced it, every change in method is published, and no AI ever sets a number. The buyers are the companies that build property and location products and carry the layer to their own customers: location data companies, property data and analytics firms, property platforms and AI products. Lenders, insurers, commercial real estate and the public sector are served through them and through inbound.

---

## 2. The problem and who pays for the answer

Property and location decisions in Great Britain run on public data that is fragmented and inconsistently keyed. Police.uk, the deprivation indices of three nations, HM Land Registry, the Office for National Statistics, Ofsted, the Environment Agency, SEPA, Natural Resources Wales, NaPTAN and OpenStreetMap all publish, on different geographies, different cadences, and with boundaries redrawn every census. A product team can call police.uk and postcodes.io in a week. Keeping a dozen publishers, three census geographies, 906,487 retired postcodes and monthly releases joined, gated and correct is the part nobody wants to own. That maintenance is the product.

The cheap lookup APIs (PropertyData, Homedata, Crystal Roof, Street Data, Propalt) describe a house and sell to agent software at £28 a month or pence per property. That segment is a price war and we do not fight in it. Our ground is the place, not the property: one model for all of Great Britain including Scotland, permanent place ids, confidence and gap reasons on every value, history, similar places, monitoring, and a licence to embed or redistribute. Three properties carry the price:

- **Deterministic.** The same inputs and the same engine version always give the same answer. There is no AI in the scoring path; the AI writes the query, never the number.
- **Versioned and disclosed.** Every response carries the methodology version. Every release is published with what it moved, Monitor says whether a change came from the data or the method, and portfolio baselines keep values at a date. We version and disclose; we do not freeze (decided 6 October, AR-965).
- **Attributed and confidence-rated.** Every value names its source, its period as calendar dates, when the publisher released it, when we loaded it, and a confidence with a reason, so a buyer knows which numbers to trust and why a number is missing.

**Go-to-market since 6 October 2026: PropTech first.** The product stays horizontal; sales and marketing narrow to companies that build a property or location product and can carry OneGoodArea to their own customers. We sell to the channel, not the end market: one partner reaches hundreds of organisations. Four builder types, in the order they buy: location data companies (the structural picture beside footfall, mobility, address and geospatial data), property data and analytics firms, property platforms (the place shown at the moment people choose), and AI products (sourced, dated facts an assistant can cite). Lenders, insurers, commercial real estate, the public sector and estate agencies keep their pages, out of the spotlight, and inbound from them is worked.

**The offer.** "Send us your locations": a prospect sends up to 1,000 of its own postcodes or place codes and gets them back enriched within two working days with a one-page read. Then the ladder: a free developer sandbox (200 calls a month, every product and the MCP server, evaluation only); a 40-day integration pilot on one existing workflow with licence terms drafted by day 30; then a platform licence to show OneGoodArea inside the partner's product with attribution, from £2,000 a month (Build scope) or £5,000 a month (Decision scope, with Scores, Monitor and Intelligence), priced by reach; or a data partnership with redistribution rights as a licence fee or revenue share. Assured, the audit-grade tier for regulated lending and underwriting, is sold only when a regulated buyer arrives. Calls are booked through Cal.com. The six earlier Stripe tiers still run underneath for billing and the sandbox cap; the sales motion is the ladder.

**Pipeline on 11 October.** Huq (location data; resells to 300+ organisations in retail, real estate and local government): pilot live, joint analysis of five retail centres delivered, a 20 to 50 site joint test prepared, footprints and finer granularity asked for. Infabode (property intelligence hub): revisiting later in the year after the data-quality points they raised were closed. 104 scored target accounts, the first 25 listed for outreach by builder type. Partner readiness documents written: source licence review, full-coverage feed specification, procurement basics, sample enrichment process.

---

## 3. What we sell

### 3.1 The four products

| Product | What the customer gets | Endpoints |
|---|---|---|
| **Signals** | The full profile of one area at neighbourhood, group or district grain, one category of it, the schools behind the schools figures by name, every Land Registry sale in the neighbourhood, a ranked list of areas by any signal, and the catalogue itself. Signals can be ordered by the period they describe, when they were loaded or when the publisher released them | `GET /v1/area` (`?grain=group|district`, `?sort=period|loaded|released`), `GET /v1/signals/:category`, `GET /v1/area/schools`, `GET /v1/area/transactions`, `GET /v1/areas`, `GET /v1/signals/metadata` |
| **Scores** | A 0 to 100 composite for a preset (moving, business, investing, research) or custom weights, each of seven dimensions ranked among neighbourhoods of the same kind (urban, suburban, rural) or against the customer's own cohort, with per-dimension confidence and a plain-sentence reason naming the data | `POST /v1/score` (`cohort` optional) |
| **Monitor** | Portfolios of places by permanent id, bulk enrichment, change detection with signed webhooks and retries, a change feed with the value before and after every move, whether a decile boundary was crossed, and the cause: the source moved, the method moved, or both | `/v1/portfolios/*`, `/v1/portfolios/:id/changes` (`?cause=`), `/v1/portfolios/:id/feed`, `/v1/places/map`, `/v1/jobs/*`, `/v1/webhooks` |
| **Intelligence** | A typed query plane (a JSON plan or a plain-English question) over 33 plannable signals, areas like this one, outliers against peers, a forecast for one signal | `POST /v1/query`, `POST /v1/peers`, `POST /v1/insights`, `POST /v1/forecast` |

### 3.2 The place registry

Every neighbourhood, group, district, region and nation in Great Britain has a permanent OneGoodArea place id (`oga_pl_` plus thirteen characters). Postcodes (live or retired), official statistical codes, earlier-census codes and names all resolve to it. When a census retires a zone, the registry records what succeeded it and with what share, so a portfolio keyed on a place id survives the redraw. Since 2 October the registry is also the store's own key (ADR 0058): every stored value is keyed by place id, and the neighbourhood code is an alias.

`GET /v1/places/resolve`, `POST /v1/places/resolve` (1,000 at a time), `GET /v1/places/:id`, `POST /v1/places/map` (1,000 rows synchronously), `POST /v1/jobs/portfolio-map` (20,000 rows as a job with paged results).

### 3.3 Levers: how enterprise is made bespoke

Cross-cutting tenancy and configuration above all four products: organisations, members and invitations, roles (owner, admin, member), custom signal bundles, saved scoring presets, peer cohorts (which also drive cohort scoring), white-labelling, and per-key IP allowlists. Twenty-seven endpoints under `/v1/orgs/*`. This is how a large customer gets a bespoke deployment and the switching cost that keeps them.

### 3.4 For agents and developers

- **MCP server** `@oga-mcp/server` 1.0.11 on npm, listed in the official MCP Registry as `com.onegoodarea/oga-mcp` (DNS-verified namespace, since 10 October). Eleven tools: area brief, score a postcode, compare postcodes, find areas, find peers, area signals, signals by category, portfolio changes, watch a portfolio, methodology for a value, engine version. Every answer is composed on the server from the engine. The server names its host client (Claude Desktop, Claude Code, Cursor) in its User-Agent so adoption is measured per client. Source mirrored read-only to the public repository `github.com/OneGoodArea/oga-mcp` on every merge, MIT licence. Listings submitted to awesome-mcp-servers and mcp.so; Glama ownership declared; an MCPB bundle for Smithery is ticketed (AR-1101).
- **Readable by machines:** a crawlable OpenAPI 3 document, `llms.txt` and `llms-full.txt`, an `/ai` page, JSON-LD Dataset, TechArticle, FAQ, Place and Breadcrumb markup, robots rules that welcome AI crawlers, a `.well-known` manifest. Every public page has metadata within search limits and sits in the sitemap, pinned by a test. Bing and Google Search Console verified; IndexNow submits every page after each production deploy.
- **Docs:** a public methodology page, a public changelog filtered by product, an interactive API reference, a playground key for evaluation, programmatic area pages for 32 cities reading live data.

---

## 4. How it works

### 4.1 Shape of the system

```
                   www.onegoodarea.com (Vercel)              api.onegoodarea.com (Render)
                   apps/web  Next.js 16                       apps/api  Fastify + Zod
  browser  ──────▶ marketing, console, docs ── BFF proxy ──▶  the whole HTTP API, all DB access
  API client ──────────────────────────────── Bearer key ──▶      │
  AI agent  ───────────────────────────────── MCP (stdio) ──▶     │  Render cron: webhook retries
                                                                  ▼
                                                            Neon Postgres (52 tables, 9.2 GB)
                                                                  ▲
                   GitHub Actions (15 workflows): monthly refresh, weekly incremental,
                   daily crime watch, quarterly devolved flood, golden probe, score references,
                   peers rebuild, registry seed, spine reload and overlay, IndexNow, MCP mirror
```

One npm-workspaces monorepo, private on GitHub, squash-merge only, every change through a Jira ticket, a branch, a pull request and CI (script checks, lint, typecheck, security audit, build, tests, deploy). 1,818 commits, 881 pull requests and 969 Jira tickets closed since March.

- `apps/api`: the standalone Fastify service. Owns every route (117 handlers, 62 under `/v1`), every database statement, every migration and every loader. Bundled with esbuild to one file and deployed to Render on every merge to main; a post-deploy health check reports the deployed commit.
- `apps/web`: the Next.js 16 application (85 routes, 64 public pages in the sitemap): marketing site, developer console, documentation, API reference, methodology, changelog, showcase demos, area pages. Talks to the API through thin proxy route handlers that mint a five-minute JWT from the NextAuth session. No SQL and no business logic in the web app.
- `packages/contracts`: the Zod schemas every DTO is defined in, imported by both apps so the wire shape cannot drift. Home of the signal contract, the methodology version registry, the place id codec, the job, feed and period contracts.
- `mcp/`: the MCP server package, its own tests, mirrored to the public repository.
- `docs/`: 67 Architecture Decision Records, architecture and operations runbooks (signal refresh, staged publication, gates, golden probe, jobs, change feed, place registry, migrations, local containers), the API reference, testing guides and the plan history.

Stack: TypeScript throughout, Next.js 16 and React 19, Fastify, Zod, Neon serverless Postgres, NextAuth v5 (Google, GitHub, credentials, magic link), Stripe, Resend, PostHog (EU) and Sentry, Anthropic Claude for the query planner and narrative only.

### 4.2 The data layer

**One contract.** Every value on the wire is a `Signal`: key, category, label, value, unit, direction, confidence and its reason, source, the period it describes as calendar dates with whether the source gave that date or it is the day the value entered the store, the publisher's release date, when we loaded it, plus normalised value and national and regional percentiles where the store ranks it. Keys are stable and namespaced (`crime.rate_per_1000`, `property.median_price`, `deprivation.england.living_environment`). A missing value is `null` with a reason, never omitted. The catalogue has one owner in the API, is seeded into the `signals` table at boot and served by `GET /v1/signals/metadata`: 83 keys (78 public; 38 crime, 15 deprivation, 12 schools, 10 amenities, 4 property, 2 transport, 2 environment), 33 of them plannable by the query planner. A neighbourhood profile serves 65 of them, including the derived signals: year-on-year changes, trend slopes over exact calendar months, peer-relative z-scores and the per-type crime counts and shares.

**Sources, as loaded on 11 October.**

| Category | Source | Grain, cadence and state |
|---|---|---|
| Crime | police.uk street-level archive; ONS Community Safety Partnership rates; Scotland recorded crime by council | Monthly counts per neighbourhood from April 2023 to August 2026 (41 months) in the time series; 14 crime types with zeros; per 1,000 residents from Census 2021; exact twelve-calendar-month windows. Greater Manchester (nothing published since 2019) and Gloucestershire (nothing since January 2026) carry no street-level rows and serve the official council-area rate with the gap named. Scotland serves council rates. A daily watcher loads a new month the day police.uk publishes it |
| Deprivation | English IMD 2025 (published 30 October 2025), Welsh WIMD 2025 (27 November 2025), Scottish SIMD 2020v2 | Decile and rank per neighbourhood, normalised per nation, with each nation's domains (income, employment, health, education, crime, and England's barriers and living environment) as deciles carrying the published rank and score. Never downscaled |
| Property | ONS median house prices by MSOA, year ending March 2026 (published 17 September 2026); HM Land Registry Price Paid | Median and year-on-year change inherited from the neighbourhood group with a ten-sale floor and a sales ladder; sales count for the ONS year; every sale since January 2025 stored by place (1,356,034 rows) and served per neighbourhood by `/v1/area/transactions` without address fields |
| Schools | Ofsted management information, monthly | 21,957 state-funded schools in England with a current grade from the most recent judgement that names one; the schools within 1 km of each neighbourhood (269,929 rows) listed by name, grade and date; confidence follows the sample size, coverage and grade age. Wales and Scotland withheld with the inspectorate named |
| Amenities | OpenStreetMap Great Britain extract of 3 October 2026 | Counts per neighbourhood from a committed, checked generator using the live query's rules (outlines count when their edge is in reach; gardens and pools only when named) |
| Transport | NaPTAN, 3 October 2026 | Rail, metro and bus stops per neighbourhood, including the areas NaPTAN publishes in grid coordinates only |
| Environment | Environment Agency flood areas (list of 5 October 2026); SEPA and Natural Resources Wales flood maps | England counted by the Environment Agency's own 3 km rule so stored and live counts agree; Scotland and Wales measured once per neighbourhood centre, refreshed quarterly; every figure names its agency and what it measures; active warnings are a live overlay |
| Geography | ONS National Statistics Postcode Lookup February 2026, ONSPD overlay, ONS and NRS boundaries and lookups, Census 2021 and 2022 | The spine: 1,806,062 live postcodes and 906,487 retired ones, each with its neighbourhood, group, district, region, nation, coordinates, output area and both rural-urban classifications |

**The store.** Publishers are read on a schedule, never per request. `signal_values` holds the current value per place and signal (2,648,582 rows over 42,696 places and 80 keys), `signal_timeseries` the history keyed by the period's end date (4,114,523 rows), `signal_percentiles` the per-nation normalisation by mid-rank (1,081,370 rows), `sales_in_place` every sale, `ofsted_schools` and `schools_in_range` the entities behind the schools aggregates, `peer_assignments` the stored peer sets (852,960 rows, about twenty per scored neighbourhood), `score_references` the rank distributions per band and nation (36 pools). About 6.8 million observations in all, growing monthly. A request reads the store; where a source is still live for a nation the response says so (`fetch_mode`: store, hybrid or live).

**Every load is a record.** Each source load writes a `load_history` row (701 so far: 694 published, 6 failed, 1 refused) carrying the publisher's release date, the date the data runs through, a SHA-256 checksum of what was read, the inputs a derived job consumed and the engine version that ran. A load stages its rows, passes structural checks, is judged by a quality gate (completeness per force and month, per-authority zero checks, column layout, how far behind the publisher it is, against a baseline of the last accepted load) and is published in one transaction or refused with the reasons recorded. Thirty-three store-health checks run after every write. A ledger of every changed row (`refresh_dirty`, 3,447,513 rows, pruned to a 30-day window for the feed) lets each step touch only what changed and feeds Monitor.

**The refresh pipeline.** GitHub Actions runs a full refresh monthly, an incremental one weekly, and a daily watcher that dispatches the incremental the moment police.uk publishes. Quarterly runs read SEPA and NRW. The chain is: migrate, refresh raw sources through their gates, rebuild the score references, derive, normalise, refresh peers, derive peer-relative signals, normalise, push the change feed, check store health, append the month, probe. Writes and normalisation are separate steps so a timeout in one cannot lose the other. Every scheduled source has a declared publisher cadence and a freshness guard, and a weekly run skips a source whose edition has not changed.

**Methodology versioning.** A registry in the contracts package lists every version with its summary, its changes and the signals and places it affects. The current version is **1.12.5**. Every response is stamped with it, the changelog, the methodology page, `llms.txt` and the announcement bar read it from the registry so a bump is one line, and Monitor uses the `affects` list to label a change as a method change.

| Version | Date | What changed |
|---|---|---|
| 1.0.0 | 8 Jul 2026 | Launch: four presets, per-dimension confidence, full attribution, deterministic scoring |
| 1.1.0 | 4 Aug | Every preset scores the same seven categories; intent changes only the weights |
| 1.2.0 | 28 Aug | Property prices from the ONS small-area series instead of a self-computed median |
| 1.3.0 | 28 Aug | Amenities and transport precomputed; transport from NaPTAN |
| 1.4.0 | 15 Sep | Property median and trend inherited from the neighbourhood group, ten-sale floor |
| 1.5.0, 1.5.1 | 16 Sep | Crime per 1,000 residents from Census 2021, full-window only; the population served as its own signal |
| 1.5.2 | 18 Sep | Schools confidence follows the number of inspected schools; a share ranked only with three or more |
| 1.6.0, 1.6.1 | 22 Sep | Urban, suburban and rural bands from the official rural-urban classifications; stations add points with diminishing returns |
| 1.7.0 | 22 Sep | Every state-funded school in England counted, with a current grade from its latest judgement |
| 1.8.0, 1.8.1 | 22 to 23 Sep | Transport, schools and amenities scored by rank among neighbourhoods of the same kind; schools confidence accounts for coverage and grade age |
| 1.9.0 to 1.9.2 | 23 Sep | Scotland and Wales flood in the store; peers must share most signals and are replaced at every recompute; property confidence follows the sales behind the median; explanations name their sources |
| 1.10.0 | 24 Sep | Derived signals over exact calendar months; four thin-sample property trends retired; sales count for the ONS year |
| 1.11.0 to 1.11.2 | 25 to 28 Sep | Percentiles by mid-rank; crime types with zeros and one reason for missing crime; twelve calendar months for every neighbourhood; Greater Manchester out of the crime rankings |
| 1.12.0 | 1 Oct | Every value dated as calendar dates with its basis; signals orderable by date |
| 1.12.1, 1.12.2 | 3 Oct | Gloucestershire gap handled like Greater Manchester; ONS prices to year ending March 2026; schools scored at the neutral midpoint without Ofsted data; every scheduled load judged by a gate |
| 1.12.3, 1.12.4 | 5 Oct | No guessed area band; amenity counts rebuilt by a committed generator from the 3 October extract |
| 1.12.5 | 6 Oct | England flood counts by the Environment Agency's 3 km rule; Environment ranks flood exposure among the nation's neighbourhoods; deprivation by domain; schools within 1 km; reads at group and district grain; retired postcodes and place ids on `GET /v1/area` |

### 4.3 Identity: the place registry

Until September the ONS code was the identity, six tables keyed on it, and Scotland's store used 2011 Data Zones while its spine used 2022 codes. The registry (ADR 0044) put a permanent id beside the store in September; in October the store was re-keyed on it (ADR 0058) and the legacy columns dropped.

- `place_entities`: id, type (neighbourhood, group, district, region, nation, country), ISO 3166 country and nation columns, name, centroid, parent, validity dates, the scheme and code the id was minted from. The id is `oga_pl_` plus twelve Crockford base32 characters (the leading 60 bits of a SHA-256 over the founding alias) and one check character: opaque, fixed-length, deterministic across environments and self-checking on customer uploads.
- `place_aliases`: every external code (lsoa21, lsoa11, msoa21, dz2011, dz2022, iz2011, iz2022, lad, rgn, ctry, ISO) with validity dates. 95,036 rows.
- `place_successions`: split, merge or irregular changes between census vintages with shares. 11,995 rows. England and Wales from the ONS exact-fit lookup; Scotland derived from the publishers' building blocks because no official correspondence exists.
- `place_data_sources`: which store key each place reads for each source family, so a Scottish zone re-cut in 2022 still reads the 2011-keyed series it was published on.
- `geo_lookup.place_id` for a one-read postcode resolve; `geo_lookup_terminated` keeps retired postcodes with the month they ended.

On production: 52,025 current places (1 country, 3 nations, 9 regions, 350 districts, 8,598 groups, 43,064 neighbourhoods) plus 6,095 retired entities (1,106 2011 LSOAs, 3,941 2011 Data Zones, 1,048 2011 Intermediate Zones), 58,120 rows in all; 1,745,685 live postcodes linked; every district and group named from the ONS, SG and NRS lookups. Seeding is idempotent: a second run writes zero rows. Northern Ireland's 49,255 postcodes stay on the spine, unseeded, and resolve as not covered (decided 21 September).

### 4.4 The scoring engine

A frozen, golden-tested engine (any refactor that changes one number fails CI). Every preset scores the same seven categories from the store; the preset only changes the weights, and callers can supply their own weights or a saved organisation preset. Transport, schools and amenities are scored by where an area ranks among neighbourhoods of the same kind (urban, suburban or rural, from the official rural-urban classifications of its postcodes, with a national fallback and no guessed band), from reference distributions rebuilt at every refresh; Environment ranks flood exposure within the nation; crime, deprivation and property score from the signals with the same confidence ladders the signals carry. A customer can rank an area against its own cohort of at least thirty areas instead of the band. Each dimension returns a score, a confidence, and a sentence of reasoning that names the data and where it came from, guarded by wording tests. Scores are enforced server-side; where narrative exists it is written after the numbers are fixed and cannot change them.

### 4.5 Intelligence

Not a chatbot. The centre is a typed plan grammar: `rank_areas` (single or compound filters, by value or percentile, within a nation, region or council), `get_area`, `score_area`, `find_peers`, `find_insights`, `find_forecast`. A programmatic caller posts a plan and no model is involved. A natural-language caller posts a question; a planner (Claude) produces a plan, Zod validates it, a plan check rejects an unknown signal, a percentile on a value-only signal or a forecast without history, and the same deterministic executor runs it. The plan is returned with the answer, so every result can be checked and re-run. A question about something we do not measure returns an explicit refusal instead of a silent substitution.

- **Peers**: k-nearest neighbours over normalised signals, 852,960 stored assignments, scoped by nation, district or an organisation's cohort; peers must share most of an area's signals and never match on peer-derived signals.
- **Insights**: rank areas by the absolute peer-relative z-score of a signal, so "moving unlike its peers" is a query, not a judgement.
- **Forecast**: a projection over the trailing 24 months of the time series with a residual-error band, never below zero, every month dated.
- **Evaluation**: a golden corpus of questions with known-correct plans, run as a CLI. Measured planner accuracy is between 85.7 and 92.9 percent run to run on the current corpus. The number is quoted as measured, not rounded up.

### 4.6 Monitor

Portfolios of places by permanent id (bulk-mapped from postcodes, codes or ids), bulk enrichment, change detection that diffs time-series periods and fires `signal.changed` webhooks signed with a rotating secret and retried by a Render cron job, and the change feed: per change, the value before and after, confidence, national decile, whether a decile boundary was crossed, when it was recorded, the refresh that caused it, and the cause (source, method or both, from the methodology registry's `affects` list), with successions listed when a held place was retired. Webhook subscriptions choose the causes they want. `portfolio.feed` is delivered after each refresh behind a forward-only watermark. Small noisy moves are held back by sample-size gates.

### 4.7 Auth, tenancy, metering, billing

- **API keys** prefixed `oga_`, stored as SHA-256 hashes with a preview, per-key IP allowlists, rate limits per key, an anonymous IP-limited tier for the query plane, auto-provisioned playground keys for evaluation, a per-key training-capture toggle.
- **Session bridge**: the web app verifies the NextAuth session and mints a short-lived HS256 JWT the API verifies; the API never sees NextAuth.
- **User types**: user, admin, superuser, and an unmetered `engineering` type for internal identities (the probe account, the showcase demos, the area pages) so verification and public pages never spend a customer quota.
- **Metering**: every call is an event; bulk calls carry a unit count; the monthly counter sums units; bulk surfaces check the remaining quota before starting.
- **Billing**: Stripe subscriptions and add-ons on the six earlier tiers, plan gates on API access and each product family. Licences are agreed by conversation and configured on the account.

### 4.8 How we know it works

- **Tests**: 2,787 in the API (twelve more need the Stripe mock CI provides), 141 in the contracts package, 341 in the web app, 183 in the MCP package, run on every pull request with lint, typecheck, build and a security audit. The CI job also runs a script check over every runnable entry point.
- **The golden probe**: a 45-postcode panel across the three nations, urban and rural, read from production every morning and after every refresh. 3,790 checks: invariants (urban floors, recency, withheld-with-reason rules, place id on every response) and drift against a committed snapshot, with known defects marked by ticket so they report without failing. Post-deploy smoke runs are opt-in to save Actions minutes.
- **Gates and health**: every scheduled load is judged before publication; thirty-three store-health checks after every write; every load carries its checksum and lineage; an operator can override a refused load only by name, with the reason recorded.
- **Migrations**: one idempotent registry of statements, tested for idempotency, run by the workflows before any data job; production DDL is applied by hand from a short script and verified.
- **Observability**: PostHog for product and API events with geo (dashboards: overview, customers, MCP adoption), Sentry for errors, a health endpoint that reports the deployed commit, a summary job at the end of every refresh run naming what each loader accepted or refused.
- **Decisions**: 67 ADRs, the architecture doc set, operations runbooks, and a per-ticket loop (Jira ticket, branch, PR, CI, squash merge, ticket closed with the merge hash).

---

## 5. Where we are: October 2026

### 5.1 The road so far

| When | What |
|---|---|
| March 2026 | Started as AreaIQ: a consumer postcode report with an AI narrative, Next.js monolith |
| April | Engine v2: per-dimension confidence, methodology versioning, OpenAPI, the first time-series cron. Renamed OneGoodArea; B2B repositioning |
| May | The signal-first restructure: API decoupled into its own service, the persisted store, the ONS spine, the monthly time-series clock, four products and six Intelligence surfaces. Then Levers. Pricing v2 on Stripe. MCP server |
| July | 1.0 launch (8 July). Pilot-led, sales-led pivot; Pedro as CEO |
| August | Seven-category scoring (1.1.0), property from the official series, storage-first amenities and transport, agent-readiness surfaces, PostHog, the Infabode and Huq conversations, the Build, Decision and Assured packaging |
| September, first half | Brand v4 (7 September). The foundation sequence: property inherited from MSOA, crime per 1,000, crime freshness, the golden probe, schools confidence, schools by name. The place registry end to end in four days (18 to 21 September): tables and seed, resolver, crosswalks for three nations, terminated postcodes, bulk map and jobs, the change feed, the seam |
| September, second half | Scoring accuracy: area bands from the official classifications, every English school counted, rank scoring among similar places, cohort scoring, Scotland and Wales flood in the store, peers that share most signals, derived signals on calendar windows, mid-rank percentiles, crime zeros and exact windows, the planner reading the catalogue. The branded API host `api.onegoodarea.com`. Account fixes. The insurance advisor call (29 September) |
| October, first week | Marcos's store spine: typed periods on every row (1.12.0), the store re-keyed on place ids, load history with staged publication, checksums and lineage, quality gates on every loader, the probe streamlined, change causes, publisher release dates, sourced reference dates, every sale stored, publisher-cadence freshness guards, no guessed area band, committed and checked generators for OSM amenities, WIMD and England flood (1.12.5 on 6 October), schools within 1 km, reads at group and district grain, area pages on live data, the legacy load tables gone |
| October, second week | GTM reset to PropTech first (6 October) and its delivery: homepage with a commissioned film, a truth pass across the site (pinning claims replaced), one PropTech page with a section per builder type, product pages with films, one licensing story on pricing, retired postcodes and place ids on `GET /v1/area`, About, `/ai` and MCP listing rewritten, showcase on an engineering identity, partner-readiness documents, an SEO pass pinned by tests, the homepage platform section rebuilt, Bing verified and IndexNow on every deploy, the MCP server in the official MCP Registry with host-client tagging, the public MCP mirror and directory submissions, the granularity research (9 October) and its plan memo (11 October), Marcos's epic to move the loaders to a VPS (10 October) |

### 5.2 What is live on production today

- Four products, Levers, webhooks with retries, MCP, the registry, bulk map, jobs, the change feed with causes, reads at three grains, sales per neighbourhood, all on `api.onegoodarea.com` behind the public site.
- Methodology 1.12.5 stamped on every response; 1.12.6 for the deprivation domains in progress (Marcos, AR-1094).
- The store: 43,064 neighbourhoods across England, Wales and Scotland with values for 42,696 of them; crime monthly counts from April 2023 to August 2026; ONS prices for the year ending March 2026 and 1,356,034 stored sales; deprivation 2025 for England and Wales and SIMD 2020 for Scotland with domains; 21,957 Ofsted schools with 269,929 school-to-neighbourhood rows; amenities and transport from the 3 October extracts; flood for three nations; about 6.8 million observations.
- The registry numbers in 4.3.
- The golden probe green on the current snapshot: 45 postcodes, 3,790 checks, 0 failed.
- The MCP server 1.0.11 on npm (about 880 downloads a month in September) and in the MCP Registry; the public mirror in sync.
- PostHog dashboards for the site, the API, customers and MCP adoption.

---

## 6. Where we are going

### 6.1 The thesis

The data layer is the product, the score is a feature, and the intelligence layer is the moat. Three things compound and cannot be bought later:

1. **The time-series corpus.** Every month not snapshotted is history nobody can recover. The clock has been running since May 2026 and every load since October carries its checksum and lineage. Change detection, anomaly, calibration and forecasting all feed on it.
2. **Identity.** A stable place id with crosswalks, successions and a change feed is what a platform's listings, a data partner's warehouse or a lender's book can be keyed on for years. Nobody in the UK sells it; the closest analogues are the addressing register (UPRN) and the ONS geography register, neither of which carries data. Since October it is also the store's own key.
3. **Methodology as a public, versioned artefact.** Determinism, disclosure and attribution are what buyers who embed the layer need, and what AI agents need to cite safely.

The product is access. The asset is memory. We never sell the corpus outright; a delivered feed is the current state under licence, and history is queryable, never exported in bulk.

### 6.2 What "the intelligence layer for place" means in practice

- A place id on every response, every portfolio, every feed entry, and a documented promise about what happens at the next census.
- Every category served from the store for all three nations, with the same confidence ladder, the same withheld-with-reason behaviour, gated loads, and a probe that proves it daily.
- Any location as input: a postcode, a place id, an official code, a name today; a point, an H3 cell, a polygon next; a property later. Every value below the neighbourhood says whether it is native to that grain, aggregated from finer units, or inherited from the neighbourhood.
- Trainable models over the corpus, in this order: calibration (do our signals predict outcomes?), anomaly as Monitor's brain, then forecasting worth the name. Statistics on our own data, not fine-tuned language models.
- An Intelligence plane an agent can drive end to end: plan grammar, MCP tools, and an evaluation number we publish and improve.
- Delivery in the shapes partners consume: the API, the MCP server, and a full-coverage feed a warehouse loads.
- An Assured tier that is really audit-grade when a regulated buyer asks for it: a model-risk documentation pack, a signed DPA, a security review, an SLA.

### 6.3 The roadmap

Each item ships when a real workflow needs it, behind a gate, with a rollback. Owners as agreed on the board; dates are the quarter the GTM pack commits to, not promises to customers.

| Horizon | Work | Why | Where it is tracked |
|---|---|---|---|
| **Now (October)** | Methodology 1.12.6 for the deprivation domains | The domains shipped in 1.12.5; the release note and probe keys follow | AR-1094 (Marcos) |
| Now | Reschedule every loader into one scheduling class per publisher cadence and run a fixed probe subset after each refresh; watch each publisher and load only what changed | Correct and cheap on GitHub Actions before anything moves | AR-1099, AR-1072 (epic AR-1098) |
| Now | Precompute group and district normalisation so percentiles serve at those grains | Reads at group and district grain carry crime only today | AR-1100 (Marcos) |
| Now | The granularity decision memo reviewed by Pedro and Marcos; questions to Huq and Geolytix on what they would send; the H3 cover dry run with measured sizes; the OS Open UPRN licence read | The business case, licence position, cost envelope and transition for going below the neighbourhood, before any ticket | `OneGoodArea-Granularity-Plan-2026-10.md`, epic AR-1088 |
| Now | Directory listings for the MCP server: awesome-mcp-servers pull request, mcp.so review, Glama claim; an MCPB bundle for Smithery | Distribution where agents and developers find servers | AR-1097, AR-1101 |
| Now | Outreach to the first 25 accounts by builder type with the sample-enrichment offer; the Huq joint test; pricing answers logged per pilot | The GTM's first 30 days | `OneGoodArea-GTM-2026-10.md` |
| **Next (Q4 2026)** | Any-location input, slice 1: a compacted H3 cover of the 43,064 neighbourhoods (`place_cells`), point and H3 cell as resolver inputs on resolve and map; every answer the neighbourhood profile labelled inherited | Roadmap stage 1 in the GTM pack; location data companies work in points and grids | AR-1088, slice 1 |
| Next | Slice 2: polygon input with overlap shares, org-scoped customer geometries, a profile endpoint taking a location object, an aggregation rule per signal (sum by share, population-weighted, withheld with decile shares, inherit); a methodology release | Huq's footprints and the Merry Hill case; the joint test | AR-1088, slice 2 (gated on Huq naming footprints or catchments) |
| Next | Slice 3: native values below the neighbourhood from sources already held: crime within a radius or per cell from the same archive files, transport stops as stored entities with H3 (AR-963), schools by distance, flood areas by point; a methodology release | The insurer's site-level ask and the platform's "this listing" ask | AR-1088, slice 3 (gated on a site-level workflow) |
| Next | Loaders on our own VPS: design ADR, generators removed in favour of gated loaders reading the published source, one container image, VPS scripts and Postgres, a gated extract to Neon, cutover with Actions as rollback | Runner minutes, time limits and writing to production Neon during a load are the constraints | Epic AR-1098 (Marcos) |
| Next | The full-coverage feed: monthly Parquet and CSV snapshot of every place and signal with changes and successions, manifest and attribution, delivered by signed URLs per partner | Data partners load data into a warehouse; today the equivalent is per request | Feed specification (AR-1067 follow-up, ticket to create) |
| Next | Partner readiness decisions: the legal read on Land Registry address terms and OpenStreetMap share-alike before the first redistribution contract; OpenStreetMap-derived columns labelled in the feed and a source swap (FHRS, CQC and NHS locations, OS Open Greenspace, GIAS) inside the scored dimensions; training capture default off for organisation keys; an attribution page | Redistribution must match the sources; platforms run security reviews | AR-1067 index (tickets to create) |
| Next | Signal additions: socioeconomic signals from Census 2021 and 2022 and ONS earnings and claimant data (the first partner request); a liquidity signal at group grain; amenities split into OpenStreetMap sub-tags; Estyn and Education Scotland school quality | Depth on the categories buyers ask about; Wales and Scotland parity | AR-892, AR-979, AR-1012, AR-952 (epic AR-953, Marcos) |
| Next | Search Console check of indexing, per-page share images, inbound links, a Huq announcement and case study once the pilot has a result and their permission | Discoverability after the SEO pass | Epic AR-987 |
| **Later** | Slice 4 of granularity: UPRN as an input from OS Open UPRN, EPC and sale history per property behind the licence reads, output areas in the registry with the first Census output-area signal | A property-book buyer; the regulated wedge | AR-1088, slice 4 (gated on a buyer) |
| Later | The history primitive: a second clock on observations so a publisher's re-issue writes a new row, `as_of` reads of values, aliases and versions, typed change kinds on the feed | What a regulated buyer asks later ("what did you tell us in March"); cheap now, impossible to backfill | Location-layer proposal v2, section 10 (to ticket) |
| Later | Trainable models: calibration first, then anomaly into Monitor | The moat showing up as product value | Product architecture, build sequence |
| Later | Assured as a real tier: reproducibility pack, SLA, security review, signed DPA | When a regulated buyer arrives inbound | Business model doc; DPA draft in `docs/_local` |
| Later | International: Global Core plus Country Packs, Ireland first, then a market chosen by a paying customer | Section 6.4 | Epic AR-999 |
| Later | Hosted MCP over Streamable HTTP with OAuth, so agents connect to a URL with no install | The MCP capability ceiling | Noted under agent readiness, not ticketed |

### 6.4 Beyond Great Britain

The ambition is not a UK company. It is the intelligence layer for place wherever property and location products run, and the way the system is built decides how expensive each new country is.

**What is already country-agnostic.** The place id scheme (an opaque id minted from a founding alias, with ISO 3166 country and nation columns on every entity), the hierarchy model (neighbourhood, group, district, region, nation, country, with parents and validity dates), aliases and successions for boundary changes, the signal contract and catalogue, the store keyed on place ids with typed periods, load history, gates and lineage, the refresh pipeline and dirty ledger, normalisation per nation, the scoring engine with rank references per band and nation, the Intelligence plane, Levers, metering and billing. None of these carry a UK assumption. Amenities and transport come from OpenStreetMap and national stop registers, so those two categories port cheaply. The H3 grid cover planned for any-location input is global by definition.

**What is UK-specific and has to be sourced per country.** The statistical spine (a postcode directory that maps every postcode to its neighbourhood, and the neighbourhood geographies themselves), crime, deprivation, property prices and sales, school inspections, flood risk, and the census population behind any per-resident rate. Each country has its own publishers, cadences, licences and boundary vintages, and each needs its own loader, its own gate, its own confidence rules and its own probe panel. A country is a data project, not a code project.

**Sequence.**

1. **Ireland.** Eircode plus CSO Small Areas, the Pobal deprivation index, the Property Price Register, the Central Statistics Office census. English-language publishers, a property market that UK platforms already touch, and the first place a foreign spine and currency go through the pipeline.
2. **A first market chosen by a customer.** The next country is picked by a paying buyer with a multi-country book or a data partner with distribution there. Candidates with strong open statistical geographies: the Netherlands (CBS neighbourhoods), Germany, France (INSEE IRIS), Australia (ABS SA1 and SA2), the United States (census tracts).

**What triggers it.** UK-only until the business is established: the gate for step 1 is recurring UK revenue at a level Pedro and Marcos set, or a signed customer or partner who needs the second country.

**Not in the sequence: Northern Ireland.** Decided 21 September: the market is too small to justify the per-nation sourcing. Its postcodes stay on the spine, unseeded, and resolve as not covered. The registry can take it later as one more nation row plus its loaders if a customer asks.

**What changes in the product when the second country lands.** Country becomes an explicit dimension on every surface: catalogue coverage per country, normalisation and percentiles per nation, a probe panel per country, methodology notes per publisher, and pricing that can be scoped by country. The place id already carries it, so nothing a customer holds has to change.

### 6.5 The team

Two builders: Pedro (founder and CEO; product, engineering, design, sales) and Marcos (co-builder; the store spine, loaders, refresh, gates, signals serving, and the infrastructure they run on). Narister tests informally. Claude Code works alongside both as the engineering pair, under a written operating loop. The process is what lets two people run at this pace: every change through a ticket, a branch, CI and a squash merge; decisions recorded as ADRs; a daily probe of production; quality gates on every load; and a persistent memory that lets any session start cold and work the same way.

---

## 7. Glossary

- **LSOA / Data Zone**: the smallest statistical neighbourhoods in England and Wales (about 1,500 people) and Scotland. Our "neighbourhood" level, 43,064 of them.
- **MSOA / Intermediate Zone**: the next level up (about 7,500 people). Our "group" level, 8,598 of them.
- **LAD**: local authority district. Our "district" level, 350 of them.
- **Output area**: the finest official census unit (100 to 625 residents); on the spine today, a registry level later.
- **NSPL / ONSPD**: the ONS postcode directories that map every postcode to its statistical geographies. Our spine and its overlay.
- **Place id**: the permanent `oga_pl_` identifier of a registered place; the store's key since October 2026.
- **Grain**: the level a value describes: neighbourhood, group, district today; point, H3 cell and polygon planned.
- **Native, aggregated, inherited**: whether a fine-grain value was computed at that grain, summed up from finer units, or carried down from the containing neighbourhood.
- **H3**: a global hexagonal grid; planned as the index that tells us which places a point or polygon touches, never as an identity.
- **UPRN**: Ordnance Survey's persistent identifier for every addressable location in Great Britain; planned as an input, never minted by us.
- **IMD / WIMD / SIMD**: the indices of multiple deprivation for England, Wales and Scotland.
- **HPSSA**: the ONS small-area house price series, now published by MSOA.
- **NaPTAN**: the national database of public transport access points.
- **Ofsted / Estyn / Education Scotland**: the school inspectorates of the three nations.
- **Signal**: one addressable, attributed, confidence-rated data point for a place.
- **Period and basis**: the calendar dates a value describes, and whether the source gave that date (reference) or it is the day the value entered the store (load).
- **Load, gate, publication**: a source load is staged, judged against the last accepted load, and published in one transaction or refused with the reasons recorded.
- **Cause**: on a Monitor change, whether the source moved, the method moved, or both.
- **Store-first / store-only / live-only**: the serving modes for a read: prefer the store and fall back live, store with no fallback, or live only.
- **Methodology version**: the engine version stamped on every response; every release is published with what it moved.
- **ADR**: an Architecture Decision Record, a short committed document recording a load-bearing decision and why.
- **MCP**: Model Context Protocol, the standard through which AI assistants call external tools.
- **Golden probe**: the daily production check of 45 postcodes against invariants and a committed snapshot.
