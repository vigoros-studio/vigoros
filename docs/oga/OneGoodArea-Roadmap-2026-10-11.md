# OneGoodArea roadmap, 11 October 2026

*The roadmap as it stands on 11 October 2026, built from what is decided (the overview, the granularity plan, Marcos's loader epic, the GTM pack, the location-layer and international proposals, the open Jira epics) and then pushed further out on purpose. Every "Now" and "Next" row has an owner, a gate and a place it is tracked. "Later" and "Beyond" are ambition: the direction we build towards, to be turned into gated rows one at a time. Companion to `OneGoodArea-Overview-2026-10-11.md` and `OneGoodArea-Traction-2026-10-11.md`.*

---

## 1. The destination

**Every place, machine-readable.** The layer that property and location products read by default when they need to know what is true about a place: any location as input, every value sourced, dated and explained, the history queryable as of any date, delivered over an API, an MCP server and a feed, in Great Britain first and then wherever those products run.

Three bets, each compounding on the last:

1. **Any location in.** Postcode, place id and code today; point, H3 cell and polygon next; property after. This turns the product from a neighbourhood lookup into a geospatial primitive that a location data company, a platform or an insurer can drop their own geometry into.
2. **The record.** A permanent id for every place, a load history with checksums and lineage, typed periods, change causes, and next the second clock that makes "what did you tell us in March" a query. Nobody can backfill it later, which is why it is the moat.
3. **Distribution without a sales force.** Partners who embed or redistribute the layer, a feed their warehouses load, catalogue listings, and agents that reach the API through MCP. One partner reaches hundreds of organisations; one registry listing reaches every agent.

What stays true at every horizon: deterministic, no AI sets a number; versioned and disclosed, never frozen; Scotland from the first day of every grain; access is sold, the corpus is not.

---

## 2. How to read it

- **Now** is this quarter (October to December 2026). **Next** is the first half of 2027. **Later** is the second half of 2027. **Beyond** is 2028 and the ambition the earlier rows serve.
- Every row ships behind a gate: a buyer, a partner answer, a design accepted, or a prior row proven on production. Nothing in Now or Next starts speculatively.
- Everything is additive. Existing inputs and responses keep working; each slice has a rollback.
- Sizes are working estimates for planning. Dates are quarters, not promises to customers.
- Owners as the board shows them today: Marcos on the store, loaders, gates and the infrastructure they run on; Pedro with Claude on the resolver, contracts, product surfaces, site and business documents. The split is agreed per epic, not fixed.

---

## 3. Now: October to December 2026

| # | What ships | Why | Gate | Owner | Tracked |
|---|---|---|---|---|---|
| N1 | The GTM's first 30 days: outreach to the first 25 accounts by builder type with the sample-enrichment offer; replies read per type; pricing answers logged per pilot; the Huq joint test (20 to 50 sites) delivered; licence terms drafted by day 30 of the pilot | The pipeline is the product's first proof | None | Pedro | `OneGoodArea-GTM-2026-10.md` |
| N2 | Methodology 1.12.6 for the deprivation domains; the golden probe switched off in source | The domains shipped in 1.12.5; release note and probe keys follow | None | Marcos | AR-1094 |
| N3 | Aggregates beyond crime: deprivation, property and schools over a group or district, with percentiles served at those grains from precomputed normalisation; amenities and flood ranked so they can be queried and planned | Reads at group and district grain carry crime only today; the planner cannot filter on amenities or flood | None | Marcos | AR-1056, AR-1100, AR-1005 |
| N4 | Loaders made correct and cheap on GitHub Actions first: one scheduling class per publisher cadence, a fixed probe subset after each refresh, every publisher watched so only changed editions load, the committed generators replaced by gated loaders reading the published source | Runner minutes and time limits are the constraint; the free minutes run out in the first days of each month | Design ADR accepted | Marcos | AR-1099, AR-1072, epic AR-1098 |
| N5 | Loaders on our own VPS: one container image, publish procedure, VPS scripts and Postgres, a gated extract to Neon, cutover with Actions as rollback | Heavy sources (the 1.6 GB police archive, ArcGIS paging, PBF extracts) stop writing to production Neon mid-load | N4 proven; the ADR | Marcos | Epic AR-1098 |
| N6 | Granularity slice 0: the decision memo reviewed; the question to Huq and Geolytix answered; the H3 cover dry run with measured sizes; the OS Open UPRN licence read | Business case, licence position and cost envelope before the first ticket | None, one week | Pedro, Marcos, Claude | `OneGoodArea-Granularity-Plan-2026-10.md`, AR-1088 |
| N7 | Slice 1: a compacted H3 cover of the 43,064 neighbourhoods (`place_cells`), point and H3 cell as resolver inputs on resolve and map; every answer the neighbourhood profile labelled inherited | Any-location input is roadmap stage 1; location data companies work in points and grids | Memo accepted | Pedro with Claude | AR-1088 |
| N8 | Slice 2: polygon input with overlap shares, org-scoped customer geometries, a profile endpoint taking a location object, an aggregation rule per signal, a methodology release; released to named pilot organisations first | Huq's footprints and the Merry Hill case; the joint test | Huq names footprints or catchments | Pedro with Claude | AR-1088 |
| N9 | Full-coverage feed, first version: a monthly Parquet and CSV snapshot of every place and signal with changes and successions, manifest and attribution, delivered by signed URLs per partner | Data partners load a warehouse; today the equivalent is per request | The first data partnership in negotiation; licence decisions 2, 3 and 5 | Pedro with Claude | Feed specification (AR-1067 follow-up, ticket to create) |
| N10 | Partner readiness: the legal read on Land Registry address terms and OpenStreetMap share-alike; OpenStreetMap-derived columns labelled in the feed; training capture default off for organisation keys; a public attribution page listing every source, licence and statement | Redistribution must match the sources; platforms run security reviews | Pedro's decisions in the AR-1067 index | Pedro | AR-1067 index (tickets to create) |
| N11 | Source swap inside the scored dimensions, started: Food Standards Agency, CQC and NHS locations, OS Open Greenspace and GIAS in place of OpenStreetMap counts where a score takes them as input | Keeps scores clear of share-alike reach; better publishers for food, care and green space | Licence decision 3 | Marcos | AR-1067 follow-up (ticket to create) |
| N12 | MCP distribution: the awesome-mcp-servers, mcp.so and Glama listings live; an MCPB bundle for one-click install and a Smithery listing; the host-client adoption chart populated from 1.0.11 onward | Agents and developers find servers in directories; the registry alone is not enough | Listings accepted | Pedro with Claude | AR-1097, AR-1101 |
| N13 | Signal additions: socioeconomic signals from Census 2021 and 2022 and ONS earnings and claimant data; a refresh job for every signal; an endpoint listing the signals the store holds per place | The first partner request; completeness of the refresh; coverage as a machine-readable surface | None | Marcos | AR-892, AR-955, AR-989 (epic AR-953) |
| N14 | Discoverability: Search Console indexing check, per-page share images, inbound links; one live page per district (350) built from the registry; a Huq announcement and case study once the pilot has a result and their permission | Organic search is 7.5% of visitors; district pages give search a page per place people name | None; the case study needs Huq | Pedro with Claude | Epic AR-987, AR-985 |

---

## 4. Next: January to June 2027

| # | What ships | Why | Gate | Tracked |
|---|---|---|---|---|
| X1 | Slice 3: native values below the neighbourhood from sources already held: crime within a radius or per cell from the same archive files, transport stops as stored entities with H3, schools by distance, flood areas by point; H3 cells at resolution 8 and 9 as served grains; a methodology release and fine-grain probe panels | The insurer's site-level ask and the platform's "this listing" ask | A site-level workflow (the Huq test or an MGA) | AR-1088 slice 3, AR-963 |
| X2 | Slice 4: UPRN as an input from OS Open UPRN, Energy Performance Certificates and sale history per property behind the licence reads, output areas in the registry with the first Census output-area signal | A property book resolved once, enriched and monitored; the regulated wedge | A named property-book buyer | AR-1088 slice 4 |
| X3 | The history primitive: a second clock on every observation so a publisher's re-issue writes a new row, `as_of` reads of values, aliases and versions, typed change kinds on the feed (observation, revision, methodology, geography, confidence, signal added, withheld), completeness monitoring on the corpus | "What did you tell us in March" becomes a field; every month without it is history lost | ADR accepted | AR-882, location-layer proposal v2 section 10 (to ticket) |
| X4 | Coverage and freshness as a product surface: per signal per nation, coverage share, latest publisher period, load date, a freshness class against the publisher's cadence, known gaps by ticket; the same class on every profile | The machine-readable form of "we know what we do not know"; auditors self-serve | None, mostly wiring over `load_history` and the source registry | Location-layer proposal v2 section 13; AR-989 as the seed |
| X5 | Tier-1 new signals: EPC at property grain (with X2), Ofcom Connected Nations broadband by postcode, Environment Agency flood-depth and Flood Zone layers on the 50 m grid, DEFRA background air quality on the 1 km grid; a non-residential property sales dataset from public sources; amenities split into OpenStreetMap sub-tags; Estyn and Education Scotland school quality for Wales and Scotland parity | Depth on the categories buyers ask about; the environment and property stories at site grain | Per source: the licence read, then a loader with a gate | AR-951, AR-1009, AR-1012, AR-952 |
| X6 | Hosted MCP: the same tools over Streamable HTTP with OAuth so an agent connects to a URL with no install, tool definitions generated from the contracts package, every argument round-tripping through its Zod schema | The MCP capability ceiling; Smithery and the connector directories | A design note; the auth model | Noted under agent readiness (to ticket) |
| X7 | Catalogue and marketplace listings: CARTO Data Observatory first; Snowflake Marketplace and AWS Data Exchange once the feed exists | Where data teams shop; listings compound with no sales effort | N9 live | `OneGoodArea-GTM-2026-10.md` section 8 |
| X8 | The Assured pack, assembled from what exists: a model-risk documentation pack (methodology registry, per-value provenance, load lineage, the licence register), the signed DPA, a security-questionnaire answer pack, an SLA | Sold only when a regulated buyer arrives, but assembled before, so the first conversation does not wait on it | A regulated buyer inbound | AR-883; `docs/_local/DPA.md`; procurement basics doc |
| X9 | International core: the Global Core plus Country Packs ADR, the audit of UK-only assumptions in contracts and endpoints, a concept and scheme for every catalogue signal, country in the score reference | A second country must be a data project, not a code project | None; done when a country could be added without changing contracts | Epic AR-999 (AR-1000 to AR-1004) |
| X10 | Bulk as a primitive: jobs beyond 20,000 rows, named customer snapshots, deltas since a snapshot cursor, dataset delivery for a customer's own locations | A large customer uploads an estate once and receives only what changed | A customer with an estate to load | Location-layer proposal v2 section 12 (to ticket) |
| X11 | Customer-defined methodology as a versioned, org-owned, immutable, explained object (named presets today become the first rung) | The lens a platform sells to its own customers; the switching cost | The first enterprise that needs its own lens | Multi-resolution proposal section 4 (to ticket) |
| X12 | Calibration study on the corpus: do our signals predict outcomes buyers care about (price movement, lettings velocity, claims)? Findings published | The first trainable model; statistics on our own data, not language models | Twelve months of history (May 2026 to May 2027) | Product architecture build sequence (to ticket) |
| X13 | The console restructured around the four products at the brand's current standard, with real screenshots feeding the marketing pages | Parked since June; the dashboard is the last surface that does not reflect the product | After N1 reads which surfaces buyers use | `project_dashboard_redesign_pending` (to ticket) |

---

## 5. Later: July to December 2027

| # | Direction | Why | What has to be true first |
|---|---|---|---|
| L1 | **Ireland**, the first country pack: Eircode and CSO Small Areas as the spine, the Pobal deprivation index, the Property Price Register, the CSO census; its own loaders, gates, probe panel and methodology notes | English-language publishers, a property market UK platforms already touch, the first foreign spine and currency through the pipeline | X9 done; recurring UK revenue at the level Pedro and Marcos set, or a signed partner who needs it |
| L2 | **Anomaly as Monitor's brain**: "this place is moving unlike its peers, look at it" as a model over the corpus, surfaced as typed change kinds; then forecasting worth the name, with calibrated bands | The moat showing up as product value | X3 and X12 |
| L3 | **Exact geometry when a buyer pays for it**: PostGIS for flood polygons intersected with a site boundary, travel-time catchments with a routing engine, walking-time and station catchments as functional resolutions | Retail site selection and insurer site assessment ask for it | A retailer or insurer workflow; the H3 index already answers membership |
| L4 | **Area type from the UN Degree of Urbanisation** on a population grid, superseding the hybrid rural-urban rule, with recalibrated benchmarks | One global definition of urban, suburban and rural; lands with the H3 work and travels to any country | X1 (the grid), L1 (a second country to prove it) |
| L5 | **Site exposure as a product**: dynamic flood (Environment Agency warnings as Monitor events with the cause), flood depth, air quality, water and energy infrastructure proximity, for the insurer and data-centre use cases the advisor named | "A current, responsive view of changing exposure, not another static score" | X5 sources; an MGA pilot |
| L6 | **The second country chosen by a customer**: the Netherlands (CBS neighbourhoods), France (INSEE IRIS), Germany, Australia (ABS SA1 and SA2) or the United States (census tracts), whichever a paying buyer with a multi-country book or a data partner with distribution there asks for | A country is a data project; the buyer decides which | L1 proven; the buyer |
| L7 | **Place ids in partners' schemas**: partners store `oga_pl_` ids in their own records, receive successions at each census and key their warehouses on them; the id scheme and crosswalk rules published as an open specification | The identity bet realised: the id becomes the thing products share | Three partners live on the feed |

---

## 6. Beyond: 2028 and the ambition

- **Every place, machine-readable, in three countries.** Great Britain, Ireland and one more, on one contract, one id scheme, one probe discipline, with normalisation and percentiles per nation and pricing scoped by country. The Amsterdam test passes by construction.
- **Any question an agent can ask.** Most calls arrive through agents: the hosted MCP endpoint, the registry listing, the catalogue listings. The evaluation number is published and improves every quarter. The AI writes the query, never the number.
- **The record as the audit standard.** Three years of monthly history, every re-issue kept, every change typed, `as_of` across years. A regulated buyer cites a OneGoodArea value in a model file because it can be reproduced to the day.
- **Reach in the thousands.** The layer sits inside the products that thousands of organisations already use, through a handful of partnerships, a feed and marketplace listings, with two founders still running the company.
- **The product below the neighbourhood is ordinary.** Points, polygons, cells and properties are inputs nobody thinks about; the neighbourhood is one grain among several, and every value still says which.

---

## 7. Proposed targets

To agree with Marcos. The arithmetic is shown so the ambition is checkable; the prices are the list prices on `/pricing`.

| Measure | End of 2026 | Mid 2027 | End of 2027 |
|---|---|---|---|
| Pilots live | 2 (Huq plus one more builder) | 4 | 6 |
| Licences or partnerships signed | 1 | 3 | 6 licences plus 2 data partnerships |
| Organisations reachable through signed partners | 300+ (Huq) | 1,000+ | 5,000+ (two of Huq, Housemark, Getmapping, a portal) |
| Annual run-rate at list prices | first contract | about £100,000 | about £250,000 to £400,000 (six licences averaging £3,500 a month is £252,000; two partnerships on top) |
| Grains served | neighbourhood, group, district; point and H3 cell (slice 1) | polygon and native values at a point (slices 2 and 3) | property for one buyer (slice 4) |
| History | typed periods, load lineage | the second clock and `as_of` live | typed change kinds on every feed entry |
| Countries | 1 | 1, with the core country-neutral | 2 (Ireland live) |
| MCP | listed in four directories; hosted endpoint designed | hosted endpoint live; 5,000 npm downloads a month | 10,000 npm downloads a month; external clients on the adoption chart every week |
| Site | 500 unique visitors a month | 1,500 | 4,000, with organic search above a quarter of visits |
| Signals in the catalogue | about 95 (socioeconomic, aggregates) | about 120 (EPC, broadband, flood depth, air) | about 150, with Wales and Scotland schools |

---

## 8. Gates and dependencies

- **Loaders.** N4 before N5; slice 3 loaders (X1) are written for Actions and re-pointed at the VPS at cutover, the rule AR-1098 states. The property loads in X2 never put raw rows on Neon.
- **Granularity.** N6 before N7; N7 before N8; N8 gated on Huq's answer; X1 gated on a site-level workflow; X2 gated on a property-book buyer. The H3 cover built in N7 is the index for everything after, including L3 and L4, and it is global, so it is also the first piece of L1.
- **Aggregation rules.** N3 (group and district normalisation) and N8 (polygon profiles) share one table of per-signal rules: sum by share, population-weighted, withheld with decile shares, inherit, native.
- **Feed and partnerships.** N9 waits on the legal read in N10 and on a partnership in negotiation; X7 waits on N9; L7 waits on three partners live.
- **History.** X3 needs its ADR and builds on `load_history`; X4 is wiring over the same tables; L2 needs X3 and X12.
- **International.** X9 makes a country a data project; L1 needs X9 and the revenue or partner gate; L6 needs L1 proven.
- **Assured.** X8 is assembled before a buyer and sold only to one; it needs the attribution page from N10 and the history work in X3 to be audit-grade.
- **Hosted MCP.** X6 needs an auth design; the Smithery listing in N12 is the first consumer.

---

## 9. What we will not do

- Northern Ireland, until a customer asks (decided 21 September 2026).
- Compete with the cheap lookup APIs on price or sell to agent software first; the ground is the place, not the property.
- Self-serve checkout as the motion; the ladder is sandbox, pilot, licence.
- Freeze numbers behind a pinned version; we version and disclose (AR-965).
- Sell the corpus or export history in bulk; a feed is the current state under licence.
- Vend addresses; we accept UPRNs and resolve them, we never mint property ids.
- Build the full matrix of grains, methodologies and countries ahead of a buyer who needs it.
- Lead with AI; it is a delivery option and a planner, never the number.

---

## 10. Where each line lives

| Area | Jira | Documents |
|---|---|---|
| GTM and partners | AR-1059 (done), AR-987 | `OneGoodArea-GTM-2026-10.md`, `OneGoodArea-GTM-Accounts-2026-10.md`, `OneGoodArea-Partner-Readiness-2026-10.md`, `OneGoodArea-Feed-Specification-2026-10.md` |
| Granularity and any-location input | AR-1088, AR-963 | `OneGoodArea-Granularity-Plan-2026-10.md`, `OneGoodArea-Granularity-Research-2026-10.md`, `OneGoodArea-Location-Layer-Proposal-v2.md` |
| Loaders and infrastructure | AR-1098 (AR-1099, AR-1072) | `docs/ARCHITECTURE/DATA-SOURCES.md`, `docs/OPERATIONS/SIGNAL-REFRESH.md` |
| Signals | AR-953 (AR-892, AR-951, AR-952, AR-955, AR-989, AR-1005, AR-1009, AR-1056, AR-1100), AR-1010 (AR-1012, AR-1094), AR-960 (AR-959, AR-963, AR-964) | `docs/ARCHITECTURE/DATA-SOURCES-ROADMAP.md` |
| Identity, history and provenance | AR-885 (AR-882, AR-883), AR-957 | ADR 0044, 0058 to 0063; location-layer proposal v2 sections 10 to 13 |
| International | AR-999 (AR-1000 to AR-1004) | `OneGoodArea-Overview-2026-10-11.md` section 6.4 |
| MCP and agents | AR-1097, AR-1101 | `project_mcp_registry_publish` notes; `docs/mcp` |
| Commercial model | AR-627 | `OneGoodArea-business-model-and-pricing.md`, `apps/web/src/components/v4/licensing.ts` |

Review this document with the overview at each quarter's end, move rows between horizons as gates open, and replace a "to ticket" note with the ticket key the day it exists.
