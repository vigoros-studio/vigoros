# OneGoodArea: the products, explained in full

*Written 12 October 2026 against methodology version 1.12.5. Every data value in this document comes from a real response of the production API on that day, lightly trimmed for length. Requests that would create account objects (organisations, bundles, presets, cohorts, portfolios, webhooks) are shown with illustrative identifiers and timestamps. Nothing here is a script or a storyboard; it is the reference material a script is written from.*

---

## How to read this document

OneGoodArea sells four products on one shared foundation. The foundation is explained once, in section 2, because every product depends on it: places and their permanent ids, the signal contract, confidence, dated periods, percentiles, and methodology versions. Sections 3 to 6 then take the products one at a time: Signals, Scores, Monitor, Intelligence. Section 7 covers Levers, the configuration layer that makes the platform bespoke to one customer (organisations, bundles, presets, cohorts). Section 8 is for developers and AI agents (the REST conventions and the MCP server). Section 9 is access and pricing. Section 10 says plainly what OneGoodArea does not do. Section 11 is a glossary, and section 12 an index of every endpoint.

Five real places are used as running examples:

| Postcode | Where | Why it is here |
|---|---|---|
| SE15 5DP | Peckham, Southwark, London | A dense urban neighbourhood with every source present. The main worked example |
| LA22 0EN | Ambleside, Lake District, Cumbria | A rural neighbourhood with thin samples, so confidence does visible work |
| EH8 9YL | Old Town, Edinburgh | Scotland: a different deprivation index, council-level crime, a different flood agency |
| CF10 1EP | Cardiff city centre | Wales: the Welsh index, a city-centre crime rate, schools withheld with the inspectorate named |
| M1 1AE | Manchester city centre | A known publisher gap, so the response shows how a missing value is explained rather than hidden |

---

## 1. OneGoodArea in one page

**What it is.** OneGoodArea is the intelligence layer for place: place intelligence infrastructure for property and location products. It turns every neighbourhood in Great Britain into sourced, dated, confidence-rated facts, gives every place a permanent id that survives boundary changes, keeps a monthly history of every value, and serves all of it through one API. Teams that build property and location products call it instead of maintaining a dozen public publishers themselves.

**The problem it solves.** Property and location decisions in Great Britain run on public data that is fragmented and inconsistently keyed. The police publish crime monthly by street. Three nations publish three different deprivation indices on three cadences. The Office for National Statistics publishes house prices by small area twice a year. Ofsted publishes school inspections monthly. The Environment Agency, Natural Resources Wales and SEPA each publish flood data in their own shape. Boundaries are redrawn at every census. A product team can wire one of these up in a week. Keeping all of them joined, current, gated and correct, month after month, is the work nobody wants to own. That maintenance is the product.

**Three properties carry the whole offer.**

- **Deterministic.** The same inputs and the same engine version always give the same answer. There is no AI in the scoring path. Where AI is used at all (to translate a plain-English question into a query), it writes the query, never the number.
- **Versioned and disclosed.** Every response carries the methodology version that produced it. Every change of method is published as a release with what it moved. Monitor tells a customer whether a value changed because the world changed or because the method changed. OneGoodArea versions and discloses; it does not freeze old methods.
- **Attributed and confidence-rated.** Every value names its source, the period it describes as calendar dates, when the publisher released it, when it was loaded, and a confidence between 0 and 1 with a written reason. A missing value is served as null with the reason, never silently omitted.

**The four products.**

| Product | One sentence | Where it lives |
|---|---|---|
| **Signals** | The facts about a place: 78 public signals across seven categories, each with source, period, confidence and percentile | `GET /v1/area` and its siblings |
| **Scores** | A deterministic 0 to 100 composite for a stated purpose, built from seven dimensions, ranked among places of the same kind or against the customer's own set of places | `POST /v1/score` |
| **Monitor** | Watch a book of places and be told what moved, by how much, and whether the cause was the data or the method | `/v1/portfolios/*`, `/v1/webhooks` |
| **Intelligence** | A typed query plane over the whole store: rank areas by any combination of signals, find similar places, find outliers, forecast one signal, or ask in plain English | `POST /v1/query`, `/v1/peers`, `/v1/insights`, `/v1/forecast` |

**The shared foundation.** All four products read the same store and share the same place registry, the same signal contract, the same confidence model, the same methodology registry and the same configuration layer (Levers). This is why they compose: a cohort defined once for Scores also scopes Peers; a bundle defined once filters Signals, gates ranked lists and constrains query plans; a portfolio built for Monitor is enriched with Scores.

**Who buys it.** Companies that build property and location products and carry OneGoodArea to their own customers: location data companies, property data and analytics firms, property platforms, and AI products that need facts they can cite. Lenders, insurers, commercial real estate and the public sector are reached through those partners and through inbound.

**How it is reached.** A REST API with bearer keys, an MCP server that puts the same engine inside AI assistants and coding tools, a web console for keys and portfolios, and machine-readable documentation (OpenAPI, llms.txt). A free sandbox key gives 200 calls a month to evaluate everything.

---

## 2. The foundation every product shares

### 2.1 Places and the place registry

OneGoodArea's unit of place is the **neighbourhood**: the Lower layer Super Output Area (LSOA) in England and Wales, and the Data Zone in Scotland. These are the smallest areas the national statistics offices publish for, typically 1,000 to 3,000 residents. Above the neighbourhood sit four coarser grains.

| Grain | England and Wales | Scotland | Count in registry |
|---|---|---|---|
| neighbourhood | LSOA 2021 | Data Zone 2022 | 43,064 |
| group | MSOA 2021 (Middle layer Super Output Area) | Intermediate Zone 2022 | 8,598 |
| district | Local authority district | Council area | 350 |
| region | Region | (the nation) | 9 |
| nation | England, Wales | Scotland | 3 |

Every one of these places has a **permanent OneGoodArea place id**. It looks like `oga_pl_YXC6XP2HFFQEA`: the prefix `oga_pl_`, twelve characters derived from the founding official code, and one check character so a typo in a customer's upload is caught rather than silently resolved to the wrong place. The id never changes. When a census retires a zone and replaces it with two, the registry records the succession and the share of the old zone that went to each new one, so a portfolio keyed on place ids survives the redraw.

Every input a customer is likely to hold resolves to a place id: a live postcode, a retired postcode (with the month it was retired), an official statistical code from the current or the previous census (LSOA 2011 and 2021, MSOA, Data Zone 2011 and 2022, Intermediate Zone, local authority, region, nation), or a place name.

**Example: resolve one postcode.**

```
GET /v1/places/resolve?q=SE15 5DP
```

```json
{
  "result": {
    "status": "resolved",
    "input": "SE15 5DP",
    "place": {
      "place_id": "oga_pl_YXC6XP2HFFQEA",
      "place_type": "neighbourhood",
      "name": "Southwark 022E",
      "country": "GB",
      "nation": "GB-ENG"
    },
    "resolved_via": { "kind": "postcode", "scheme": null, "value": "SE15 5DP" },
    "postcode": { "postcode": "SE15 5DP", "status": "live", "terminated_on": null }
  },
  "meta": { "engine_version": "1.12.5", "generated_at": "2026-10-12T15:50:03.287Z" }
}
```

**Example: resolve a mixed batch.** Up to 1,000 inputs per call, in any mix. Each row says how it resolved, or why it did not.

```
POST /v1/places/resolve
{ "inputs": ["SE15 5DP", "E01003963", "S01008677", "BT1 1AA", "NOT A CODE", "W01001945"] }
```

```json
{
  "count": 6, "resolved": 4, "ambiguous": 0, "not_found": 2,
  "results": [
    { "status": "resolved", "input": "SE15 5DP",
      "place": { "place_id": "oga_pl_YXC6XP2HFFQEA", "place_type": "neighbourhood", "name": "Southwark 022E", "country": "GB", "nation": "GB-ENG" },
      "resolved_via": { "kind": "postcode", "scheme": null, "value": "SE15 5DP" } },
    { "status": "resolved", "input": "E01003963",
      "place": { "place_id": "oga_pl_WQF8BJ3E3PM76", "place_type": "neighbourhood", "name": "Southwark 016A", "country": "GB", "nation": "GB-ENG" },
      "resolved_via": { "kind": "code", "scheme": "lsoa21", "value": "E01003963" } },
    { "status": "resolved", "input": "S01008677",
      "place": { "place_id": "oga_pl_PXVNP1058BC6C", "place_type": "neighbourhood", "name": "Old Town, Princes Street and Leith Street - 04", "country": "GB", "nation": "GB-SCT" },
      "resolved_via": { "kind": "code", "scheme": "dz2011", "value": "S01008677" } },
    { "status": "not_found", "input": "BT1 1AA", "reason": "nation_not_covered",
      "message": "BT1 1AA is a known postcode, but its nation is not in the registry yet." },
    { "status": "not_found", "input": "NOT A CODE", "reason": "name_not_supported_in_batch",
      "message": "Place names resolve one at a time through GET /v1/places/resolve." },
    { "status": "resolved", "input": "W01001945",
      "place": { "place_id": "oga_pl_GXEKET75AQ362", "place_type": "neighbourhood", "name": "Cardiff 048D", "country": "GB", "nation": "GB-WLS" },
      "resolved_via": { "kind": "code", "scheme": "lsoa11", "value": "W01001945" } }
  ]
}
```

**Example: an ambiguous name.** A name that matches more than one place is never guessed. The response lists the candidates and the caller chooses.

```
GET /v1/places/resolve?q=Peckham
```

```json
{
  "result": {
    "status": "ambiguous",
    "input": "Peckham",
    "candidates": [
      { "label": "West Peckham, Tonbridge and Malling, Kent", "postcode": "ME18 5JL",
        "place": { "place_id": "oga_pl_JK0B3ET0ZY2RY", "place_type": "neighbourhood", "name": "Tonbridge and Malling 007A", "country": "GB", "nation": "GB-ENG" } },
      { "label": "Peckham, Southwark, Greater London", "postcode": "SE15 5ST",
        "place": { "place_id": "oga_pl_2GQAQ2KAGZYQR", "place_type": "neighbourhood", "name": "Southwark 022D", "country": "GB", "nation": "GB-ENG" } }
    ]
  }
}
```

**Example: read a place.** A place record carries its aliases (every official code it has ever had, with validity dates), its parents up the hierarchy, and its predecessors and successors across census redraws.

```
GET /v1/places/oga_pl_YXC6XP2HFFQEA
```

```json
{
  "place": {
    "place_id": "oga_pl_YXC6XP2HFFQEA", "place_type": "neighbourhood", "name": "Southwark 022E",
    "country": "GB", "nation": "GB-ENG",
    "id_origin": { "scheme": "lsoa21", "code": "E01004067" },
    "centroid": { "latitude": 51.472134, "longitude": -0.0689 }
  },
  "aliases": [
    { "scheme": "lsoa21", "code": "E01004067", "current": true },
    { "scheme": "lsoa11", "code": "E01004067", "valid_to": "2021-03-21", "current": false }
  ],
  "parents": [
    { "place_id": "oga_pl_3X4K57N4FSMRH", "place_type": "group", "name": "Southwark 022" },
    { "place_id": "oga_pl_QGEC3RD3KKH89", "place_type": "district", "name": "Southwark" },
    { "place_id": "oga_pl_Y0CFT9HX7WK7T", "place_type": "region", "name": "London" }
  ],
  "predecessors": [], "successors": []
}
```

Northern Ireland's postcodes are recognised but not covered; they resolve as `nation_not_covered`.

### 2.2 The Signal: one contract for every value

Every value OneGoodArea serves, in any product, is a **Signal** with the same fields. This is the single most important idea in the platform: a crime count, a deprivation decile, a median house price and a flood-area count all arrive in the same shape, so a customer writes one parser and one display.

| Field | Meaning | Example (SE15 5DP, crime per 1,000) |
|---|---|---|
| `key` | Stable, namespaced identifier. The part before the first dot is the category | `crime.rate_per_1000` |
| `category` | One of seven: crime, deprivation, property, schools, amenities, transport, environment | `crime` |
| `label` | Human label | `Recorded crimes per 1,000 residents (12 months)` |
| `value` | The number (or null when there is no coverage) | `731.9` |
| `unit` | The unit of the value | `per_1000` |
| `direction` | Whether higher is better, lower is better, or neutral | `lower_is_better` |
| `confidence` | 0 to 1 | `1` |
| `confidence_reason` | A sentence saying why, naming the publisher and the sample | `police.uk: 1,619 recorded crimes over 12 months, a robust sample. Rate is per 1,000 usual residents (Census 2021).` |
| `source` | The publisher | `police.uk` |
| `period` | The calendar dates the value describes | `{ "start": "2025-09-01", "end": "2026-08-31" }` |
| `period_basis` | `reference` when the publisher states the date the value describes; `load` when the only honest date is the day it entered the store | `reference` |
| `released_at` | When the publisher released this edition, where known | (null for police.uk) |
| `loaded_at` | When OneGoodArea loaded it | `2026-10-01T10:54:39.905Z` |
| `percentile` | Where this value sits among every neighbourhood in the nation, 0 to 100 (where the store ranks the signal) | `99.42` |
| `regional_percentile` | The same within the region | `98.97` |
| `normalized_value` | The value scaled 0 to 1 within the nation, used for peers and scoring | |
| `detail` | Extra structure where the publisher supplies it (a deprivation domain's published rank and score) | |

The same signal as it appears on the wire:

```json
{
  "key": "crime.rate_per_1000",
  "category": "crime",
  "label": "Recorded crimes per 1,000 residents (12 months)",
  "value": 731.9,
  "unit": "per_1000",
  "direction": "lower_is_better",
  "confidence": 1,
  "confidence_reason": "police.uk: 1,619 recorded crimes over 12 months, a robust sample. Rate is per 1,000 usual residents (Census 2021).",
  "source": "police.uk",
  "observed_period": "2025-09-01 to 2026-08-31",
  "period": { "start": "2025-09-01", "end": "2026-08-31" },
  "period_basis": "reference",
  "released_at": null,
  "loaded_at": "2026-10-01T10:54:39.905Z",
  "percentile": 99.42,
  "regional_percentile": 98.97
}
```

And a signal that has no value, from EH8 9YL in Edinburgh. Note that the value is null and the reason says why; the key is never missing from the response:

```json
{
  "key": "crime.rate_per_1000",
  "category": "crime",
  "label": "Recorded crimes per 1,000 residents (12 months)",
  "value": null,
  "unit": "per_1000",
  "confidence": 0,
  "confidence_reason": "police.uk publishes no street-level crime for Scotland.",
  "source": "police.uk"
}
```

### 2.3 Confidence

Confidence is a number between 0 and 1 attached to every value, with a written reason. It is not a guess at accuracy; it follows explicit ladders that depend on the sample behind the value, the coverage of the source, and the age of the data. The reason text tells the reader which rung applied.

| Confidence | What it means | Example reason |
|---|---|---|
| 1.0 | Crime: 100 or more recorded crimes over a full 12 months | `police.uk: 1,619 recorded crimes over 12 months, a robust sample.` |
| 0.9 | An official index or register, or a robust sample (30 or more sales; 6 or more graded schools) | `IMD 2025: the official index for this neighbourhood.` / `ONS HPSSA: rolling-year median for the neighbourhood group this area belongs to (MSOA E02000828), from 43 sales in the year.` |
| 0.85 | Crowd-sourced counts (OpenStreetMap amenities), stored crime rows | `OpenStreetMap (precomputed nearby counts); coverage is crowd-sourced and varies by area.` |
| 0.7 | Crime: 30 to 99 crimes | `police.uk: 64 recorded crimes over 12 months, a moderate sample.` |
| 0.6 | A moderate sample (10 to 29 sales; 3 to 5 graded schools), or a 12-month crime window with zero crimes | `HM Land Registry: 28 sales in the period, a moderate sample; treat the figure as indicative.` |
| 0.4 | A small sample (fewer than 10 sales; fewer than 3 graded schools; fewer than 30 crimes) | `HM Land Registry: only 7 sales in the period, a small sample; treat the figure as indicative.` / `Ofsted: 1 graded school within 1.5km (inspections Feb 2024), too few for a reliable share of Good or Outstanding; the share is served but not ranked` |
| 0.3 | Context from a coarser geography, served for information and never scored | `Council-area recorded crime rate for City of Edinburgh (2025/2026); council-level context, not street-level and not used in the safety score.` |
| 0 | No coverage, a failed check, or not included in this response | `police.uk publishes no street-level crime for Scotland.` / `Environment Agency: flood warnings could not be checked (timeout); the count is unknown, not zero.` |

Two rules worth knowing. Schools confidence drops one rung when fewer than three in four schools in range carry a grade, and one more when the median grade is more than six years old (a full inspection cycle). A share of Good or Outstanding schools is **served but not ranked** when fewer than three schools are graded: the number is shown, but it earns no percentile and does not rank the area.

### 2.4 Periods and dates

Every value carries the calendar dates it describes, and a `period_basis` saying how that date was established.

- **`reference`**: the publisher states the period. Crime is the twelve calendar months ending at police.uk's latest published month (on 12 October 2026: 1 September 2025 to 31 August 2026). The ONS house price median is a rolling year (1 April 2025 to 31 March 2026, the "year ending March 2026" edition). Census population is a point in time (21 March 2021). An Ofsted aggregate is a point on the register's "as at" date.
- **`load`**: the publisher gives no single date for the value, so the honest date is the day it entered the store. The deprivation indices work this way: the English index of 2025 is built from inputs spanning several years, so the value carries `released_at: 2025-10-30` (when the index was published) and a load-day period.

Alongside the period, `released_at` is the publisher's release date for the edition and `loaded_at` is when OneGoodArea loaded it. Signals can be sorted by any of the three (`?sort=period|loaded|released` on the profile endpoints), so a customer can ask "what is the most recently described?", "what was loaded most recently?" or "what did a publisher release most recently?".

### 2.5 Percentiles and normalisation

Where the store ranks a signal, every neighbourhood's value is placed among all neighbourhoods in its nation as a **percentile from 0 to 100**, and again within its region as `regional_percentile`. Percentiles use the mid-rank rule: the share of neighbourhoods below the value, plus half the share equal to it, so a run of identical values (common with deciles and inherited medians) is placed fairly rather than all at the bottom or all at the top. The `normalized_value` is the same placement as a 0 to 1 number, and it is what peers and scoring consume.

Ranking is always within the nation. An English neighbourhood is ranked among the 33,755 English neighbourhoods, a Welsh one among 1,917, a Scottish one among 6,976. Deprivation is never compared across nations because the three indices are built differently.

### 2.6 Native, inherited and aggregated values

A signal's value reaches the neighbourhood in one of three ways, and the confidence reason always says which.

- **Native.** The publisher publishes at neighbourhood grain. Crime (police.uk tags each crime with its LSOA), deprivation (published by LSOA and Data Zone), the count of sales (each sale mapped to its neighbourhood by postcode).
- **Inherited.** The publisher publishes at a coarser grain and every neighbourhood in that area carries the same value, with the reason saying so. The median house price and its year-on-year change come from the ONS small-area series published by MSOA (the neighbourhood group), because a neighbourhood's own handful of sales is too thin to call a median. The reason reads: `ONS HPSSA: rolling-year median for the neighbourhood group this area belongs to (MSOA E02000828), from 43 sales in the year. Every neighbourhood in the group carries it`.
- **Aggregated.** OneGoodArea counts things around the neighbourhood's population-weighted centre. Schools within 1,500 m and within 1,000 m; restaurants, pubs and shops within 1,000 m; healthcare, parks and leisure within 1,500 m; rail and metro stations within 2 km; bus stops within 500 m; flood areas by the Environment Agency's own 3 km rule.

Derived signals are computed from stored history: year-on-year and six-month changes in crime, a 24-month trend slope, and peer-relative z-scores (how far a neighbourhood sits from its twenty most similar neighbourhoods, in standard deviations).

### 2.7 Methodology versions

Every response carries the methodology version that produced it, in the body as `engine_version` and in the `X-Engine-Version` response header. On 12 October 2026 that is `1.12.5`.

A **release** is a published change of method: a new signal, a new confidence rule, a new way of ranking, a source replaced. Each release has a version, a date, a one-paragraph summary, and the list of signals and dimensions it affects. There have been 26 releases since launch on 8 July 2026, all listed publicly in the changelog and returned by `GET /v1/meta`.

| Version | Date | What changed |
|---|---|---|
| 1.0.0 | 8 Jul 2026 | Deterministic engine at launch: four presets, seven categories, confidence and source on every value |
| 1.1.0 | 4 Aug 2026 | Every preset scores the same seven dimensions; only the weights change with intent |
| 1.2.0 | 28 Aug 2026 | Property median and change from the ONS small-area series |
| 1.3.0 | 28 Aug 2026 | Amenities precomputed from OpenStreetMap; transport from NaPTAN |
| 1.4.0 | 15 Sep 2026 | Property inherited from the neighbourhood group; confidence from the group's sales; no trend from fewer than ten sales |
| 1.5.0, 1.5.1 | 16 Sep 2026 | Crime per 1,000 residents from Census 2021; population served as its own signal |
| 1.5.2 | 18 Sep 2026 | Schools confidence follows the number of graded schools; a share is ranked only with three or more |
| 1.6.0, 1.6.1 | 22 Sep 2026 | Urban, suburban and rural bands from the official rural-urban classifications; stations add points with diminishing returns |
| 1.7.0 | 22 Sep 2026 | Every state-funded school in England counted, with a current grade from its most recent judgement |
| 1.8.0, 1.8.1 | 22 to 23 Sep 2026 | Transport, schools and amenities scored by rank among neighbourhoods of the same kind; schools confidence accounts for coverage and grade age |
| 1.9.0 to 1.9.2 | 23 Sep 2026 | Scotland and Wales flood stored per neighbourhood; peers must share most signals; property confidence follows the sales behind the median |
| 1.10.0 | 24 Sep 2026 | Derived signals over exact calendar months; sales count for the ONS year |
| 1.11.0 to 1.11.2 | 25 to 28 Sep 2026 | Mid-rank percentiles; crime types with zeros and one reason for missing crime; the same twelve calendar months for every neighbourhood |
| 1.12.0 | 1 Oct 2026 | Every value dated as calendar dates with its basis; signals orderable by date |
| 1.12.1, 1.12.2 | 3 Oct 2026 | Gloucestershire handled as a coverage gap; ONS prices to year ending March 2026; a score without school data sits at the neutral midpoint; every scheduled load judged by a quality gate |
| 1.12.3, 1.12.4 | 5 Oct 2026 | No guessed area band; amenity counts rebuilt from the 3 October extract |
| 1.12.5 | 6 Oct 2026 | England flood counts by the Environment Agency's 3 km rule; Environment ranks flood exposure among the nation's neighbourhoods; deprivation by domain; schools within 1 km; reads at group and district grain |

The stance is **version and disclose, never freeze**. Old versions are not kept executable, because a frozen method would silently diverge from the data. Instead every change is announced, every response is stamped, and Monitor labels any move caused by a release as a method change (section 5), so a customer can always tell data from method.

### 2.8 How the store is kept current

Publishers are read on a schedule, never per request. A request reads the store, so responses are fast and reproducible; the response says so in `meta.fetch_mode` (`store` from the store alone, or `hybrid` where a live call was added for one value, such as the active flood warnings for a postcode the store had not seen before).

- A **full refresh** runs monthly, reloading every source in order (deprivation, property, crime, schools, flood, amenities, transport), then rebuilding score references, derived signals, percentiles, peers, the change feed and the monthly history.
- An **incremental refresh** runs weekly and touches only what changed. Every source declares its publisher's cadence and skips an edition it already holds.
- A **daily watcher** checks whether police.uk has published a new month (it publishes about five weeks after the month ends, on a day that moves) and triggers the incremental refresh the same day.
- Devolved flood maps (Scotland and Wales) are re-measured quarterly.

Every load is a record: the publisher's release date, the date the data runs through, a checksum of what was read, and the engine version that ran. A load is staged, checked structurally, judged by a quality gate (completeness per police force and month, all-zero checks per authority, row counts, how far behind the publisher it is, against the last accepted load) and published in one transaction or refused with the reasons recorded. A panel of 45 postcodes across the three nations is read from production every morning and after every refresh, checking invariants and drift against a committed snapshot.

### 2.9 Coverage by nation

| | England | Wales | Scotland |
|---|---|---|---|
| Neighbourhoods | 33,755 LSOAs | 1,917 LSOAs | 6,976 Data Zones (store), 7,392 2022 zones in the registry |
| Crime | police.uk street level, 14 types, per 1,000 residents. Greater Manchester (since 2019) and Gloucestershire (since 2026) have no street-level publication; their council-area rate is served with the gap named | police.uk street level | Council-area recorded crime rate (Police Scotland), served as context at confidence 0.3; no street level |
| Deprivation | IMD 2025, 7 domains | WIMD 2025, 8 domains | SIMD 2020, 7 domains |
| Property | ONS median by MSOA, year ending March 2026; every Land Registry sale since 2025 per neighbourhood | Same | Not covered (Registers of Scotland not loaded); served as null with reason |
| Schools | Ofsted, every state-funded school, within 1.5 km and 1 km | Withheld: Estyn discontinued comparable overall grades in 2022; reason served | Withheld: Education Scotland inspects on a sample basis; reason served |
| Amenities, transport | OpenStreetMap and NaPTAN | Same | Same |
| Flood | Environment Agency flood areas within 3 km; live active warnings within 5 km | Natural Resources Wales maps within 250 m of the centre | SEPA maps (river, surface water, coastal) within 250 m of the centre |

Northern Ireland is out of scope.

---
## 3. Signals

### 3.1 What Signals is

Signals is the facts product: the full, sourced, dated, confidence-rated profile of any place in Great Britain. It answers "what is true about this place, according to whom, as of when, and how sure can I be?". It is the foundation the other three products are built from, and most customers start here: a property platform showing the neighbourhood beside a listing, a location data company adding the structural picture beside its footfall data, an AI assistant citing a fact about a place.

What a customer gets:

- The **full profile** of one area at neighbourhood, group or district grain (65 signals for an English neighbourhood with every source present).
- **One category** of that profile (crime only, schools only).
- The **entities behind an aggregate**: every school within range by name, grade and distance; every Land Registry sale in the neighbourhood since 2025 without address fields.
- A **ranked list** of areas by any ranked signal, filtered by nation, district, value or percentile.
- The **catalogue itself**, so a product can discover keys, labels, units and sources at runtime.

### 3.2 The catalogue

83 signal keys, 78 of them public (five are internal rows used to rebuild a source and never served). 33 of the public keys are **plannable**, meaning the Intelligence query plane can rank and filter on them. 29 are **ranked**, meaning they carry national and regional percentiles.

**Crime (38 keys, source police.uk street-level crime, England and Wales, monthly).**

| Key | Label | Unit |
|---|---|---|
| `crime.total_12m` | Recorded crimes (12 months) | count |
| `crime.monthly_rate` | Recorded crimes per month | per_month |
| `crime.rate_per_1000` | Recorded crimes per 1,000 residents (12 months) | per_1000 |
| `crime.population` | Usual residents (Census 2021) | count |
| `crime.monthly_count` | Recorded crimes in month (history series, used by Monitor and Forecast) | count |
| `crime.total_12m_change_pct_yoy` | Change in recorded crimes, last 12 months against the 12 before | pct |
| `crime.total_6m_change_pct` | Change in recorded crimes, last 6 months against the 6 before | pct |
| `crime.monthly_count_trend_slope_24m` | Monthly trend in recorded crimes over 24 months | crimes per month, per month |
| `crime.total_12m_peer_relative_z` | Recorded crime against the 20 most similar areas | z-score |
| `crime.council_rate` | Council recorded crime per 10,000 (Scotland; and England's two gap areas) | per_10k |
| `crime.<type>_12m` (14 keys) | Count of one crime type over 12 months | count |
| `crime.<type>_share_12m` (14 keys) | That type's share of all crime | pct |

The fourteen types are the police.uk categories: anti-social behaviour, bicycle theft, burglary, criminal damage and arson, drugs, other crime, other theft, possession of weapons, public order, robbery, shoplifting, theft from the person, vehicle crime, and violence and sexual offences. A type with no crimes in the window reads 0, not null.

**Deprivation (15 keys, source the national index of each nation, an edition every few years).**

| Key | Label | Nations |
|---|---|---|
| `deprivation.imd_decile` | Deprivation decile (1 most deprived, 10 least) | all |
| `deprivation.imd_rank` | Deprivation rank (higher is less deprived) | all |
| `deprivation.income`, `.employment`, `.health`, `.education` | Domain deciles | all |
| `deprivation.crime` | Crime deprivation decile | England, Scotland |
| `deprivation.england.barriers_housing_services`, `.england.living_environment` | England-only domains | England |
| `deprivation.wales.access_services`, `.wales.housing`, `.wales.community_safety`, `.wales.physical_environment` | Wales-only domains | Wales |
| `deprivation.scotland.access_services`, `.scotland.housing` | Scotland-only domains | Scotland |

Each domain signal carries the published rank, and the published score where the nation publishes one, in `detail`. Deciles are the publisher's own, never recomputed, and never compared across nations.

**Property (4 keys, England and Wales).**

| Key | Label | Unit | Source | How it reaches the neighbourhood |
|---|---|---|---|---|
| `property.median_price` | Median sale price | GBP | ONS small-area house prices (HPSSA) | Inherited from the neighbourhood group (MSOA), rolling year |
| `property.price_change_pct` | Price change (year on year) | pct | ONS HPSSA | Inherited from the group |
| `property.transaction_count` | Sales in the year | count | HM Land Registry Price Paid | Native: each sale mapped to its neighbourhood by postcode |
| `property.median_price_peer_relative_z` | Median sale price against the 20 most similar areas | z-score | derived | |

**Schools (11 public keys, source Ofsted, England only, monthly).** All measured around the neighbourhood's centre.

| Key | Label |
|---|---|
| `schools.rated_count` | Graded schools within 1.5 km |
| `schools.total_count` | Schools within 1.5 km, graded or not |
| `schools.good_or_outstanding_pct` | Share of graded schools rated Good or Outstanding |
| `schools.outstanding_count`, `.good_count`, `.requires_improvement_count`, `.inadequate_count` | Count by grade |
| `schools.median_grade_age_years` | Median age of the grades in years |
| `schools.rated_count_1km`, `.total_count_1km`, `.good_or_outstanding_pct_1km` | The same three measures within 1 km |

**Amenities (6 public keys, source OpenStreetMap Great Britain extract, all three nations).**

| Key | Label | Radius |
|---|---|---|
| `amenities.total` | Amenities nearby (total) | sum of all categories |
| `amenities.restaurants_cafes` | Restaurants and cafes | 1,000 m |
| `amenities.pubs_bars` | Pubs and bars | 1,000 m |
| `amenities.shops` | Shops (supermarkets and convenience) | 1,000 m |
| `amenities.healthcare` | Healthcare (pharmacies, GPs, hospitals, dentists, clinics) | 1,500 m |
| `amenities.parks_leisure` | Parks and leisure (parks, playgrounds, sports and fitness centres, named gardens and pools) | 1,500 m |

**Transport (2 keys, source NaPTAN, the national public transport access node register, all three nations).**

| Key | Label | Radius |
|---|---|---|
| `transport.stations` | Rail and metro stations | 2 km |
| `transport.bus_stops` | Bus stops | 500 m |

**Environment (2 keys).**

| Key | Label | Source and measure |
|---|---|---|
| `environment.flood_areas_nearby` | Flood risk zones within 3 km | England: Environment Agency flood areas by the agency's own 3 km rule. Wales: Natural Resources Wales maps within 250 m of the centre. Scotland: SEPA maps within 250 m |
| `environment.active_flood_warnings` | Active flood warnings | England only, live from the Environment Agency within 5 km of the postcode at request time; never stored |

### 3.3 The endpoints

| Endpoint | What it returns | Parameters |
|---|---|---|
| `GET /v1/area` | The full profile | `postcode` (live or retired) or `area` (a place id, an official code, or a place name); `grain` = `neighbourhood` (default), `group` or `district`; `sort` = `period`, `loaded` or `released`; `bundle` |
| `GET /v1/signals/{category}` | One category of the profile | `postcode` or `area`, `sort`, `grain` |
| `GET /v1/signals/metadata` | The catalogue: every key with label, unit, direction, source, visibility and whether it is plannable | none |
| `GET /v1/area/schools` | Every school within 1.5 km, by name | `postcode` |
| `GET /v1/area/transactions` | Every Land Registry sale in the neighbourhood over the last twelve months | `postcode` |
| `GET /v1/areas` | A ranked list of neighbourhoods by one signal | `signal` (required), `country`, `lad` (district code), `min_percentile`, `max_percentile`, `min_value`, `max_value`, `sort` = `percentile`, `percentile_desc`, `value` or `value_desc`, `limit` up to 1,000, `bundle` |

Every response carries `meta.engine_version`, `meta.generated_at`, `meta.sources` (the publishers behind this response), `meta.fetch_mode` and `meta.grain`.

### 3.4 Worked example: the full profile of SE15 5DP

```
GET /v1/area?postcode=SE15 5DP
```

The response has three parts: `geo` (where this is), `signals` (65 of them), and `meta`.

```json
{
  "geo": {
    "query": "SE15 5DP",
    "postcode": "SE15 5DP",
    "postcode_status": "live",
    "latitude": 51.473222, "longitude": -0.070795,
    "lsoa": "E01004067", "msoa": "E02000828",
    "admin_district": "Southwark", "region": "London", "country": "England",
    "area_type": "urban", "rural_urban": "Urban major conurbation",
    "place_id": "oga_pl_YXC6XP2HFFQEA"
  },
  "signals": [ "... 65 signals ..." ],
  "meta": {
    "engine_version": "1.12.5",
    "generated_at": "2026-10-12T15:49:56.644Z",
    "sources": ["police.uk", "ONS Census 2021", "IMD 2025", "ONS HPSSA", "HM Land Registry", "Ofsted", "OpenStreetMap", "NaPTAN", "Environment Agency"],
    "fetch_mode": "store",
    "grain": "neighbourhood"
  }
}
```

Every signal in that response, by category. Percentiles are national (England) where the store ranks the signal.

**Crime** (period 1 Sep 2025 to 31 Aug 2026, police.uk's latest twelve months on 12 Oct 2026; confidence 1.0, "1,619 recorded crimes over 12 months, a robust sample").

| Key | Value | Percentile |
|---|---|---|
| `crime.total_12m` | 1,619 | 99.6 |
| `crime.monthly_rate` | 135 per month | |
| `crime.rate_per_1000` | 731.9 per 1,000 residents | 99.4 |
| `crime.population` | 2,212 (Census 2021, 21 Mar 2021) | |
| `crime.anti_social_behaviour_12m` / share | 414 / 26% | |
| `crime.violence_sexual_offences_12m` / share | 299 / 18% | |
| `crime.shoplifting_12m` / share | 231 / 14% | |
| `crime.other_theft_12m` / share | 136 / 8% | |
| `crime.theft_from_the_person_12m` / share | 132 / 8% | |
| `crime.robbery_12m` / share | 70 / 4% | |
| `crime.public_order_12m` / share | 66 / 4% | |
| `crime.drugs_12m` / share | 65 / 4% | |
| `crime.burglary_12m` / share | 54 / 3% | |
| `crime.vehicle_crime_12m` / share | 54 / 3% | |
| `crime.bicycle_theft_12m` / share | 42 / 3% | |
| `crime.criminal_damage_arson_12m` / share | 33 / 2% | |
| `crime.other_crime_12m` / share | 12 / 1% | |
| `crime.possession_of_weapons_12m` / share | 11 / 1% | |

A note on the rate. 731.9 crimes per 1,000 residents is startling, and it is correct. This neighbourhood contains Peckham's high street: crime is recorded where it happens, against the 2,212 people who live there. Per-resident rates in town centres read high everywhere for this reason, and the 99th percentile tells the reader exactly that. The group and district reads below show how the picture changes with grain.

**Deprivation** (IMD 2025, released 30 Oct 2025; confidence 0.9, "the official index for this neighbourhood").

| Key | Value | Percentile (national / regional) |
|---|---|---|
| `deprivation.imd_decile` | 2 (1 most deprived, 10 least) | 15.0 / 11.0 |
| `deprivation.imd_rank` | 6,010 of 33,755 | 17.8 / 14.4 |
| `deprivation.income` | decile 2 | |
| `deprivation.employment` | decile 3 | |
| `deprivation.health` | decile 6 | |
| `deprivation.education` | decile 5 | |
| `deprivation.crime` | decile 1 | |
| `deprivation.england.barriers_housing_services` | decile 2 | |
| `deprivation.england.living_environment` | decile 2 | |

**Property** (ONS year ending March 2026, released 17 Sep 2026).

| Key | Value | Confidence and reason |
|---|---|---|
| `property.median_price` | £500,000 (86th percentile nationally, 45th in London) | 0.9: "rolling-year median for the neighbourhood group this area belongs to (MSOA E02000828), from 43 sales in the year. Every neighbourhood in the group carries it" |
| `property.price_change_pct` | +20.5% year on year | 0.9, same basis |
| `property.transaction_count` | 7 sales in the neighbourhood itself | 0.4: "only 7 sales in the period, a small sample; treat the figure as indicative" |

This row is the inherited rule at work: the median is the group's, from 43 sales, at confidence 0.9; the neighbourhood's own count of 7 sales is served alongside at 0.4 so the reader knows how thin the local evidence is.

**Schools** (Ofsted register as at 31 Aug 2026; confidence 0.9).

| Key | Value | Percentile |
|---|---|---|
| `schools.total_count` | 28 within 1.5 km | |
| `schools.rated_count` | 25 graded | 98.3 |
| `schools.good_or_outstanding_pct` | 96% | 48.1 |
| `schools.outstanding_count` / `good_count` / `requires_improvement_count` / `inadequate_count` | 3 / 21 / 1 / 0 | |
| `schools.median_grade_age_years` | 2.9 years | |
| `schools.total_count_1km` / `rated_count_1km` | 14 / 12 | 98.2 |
| `schools.good_or_outstanding_pct_1km` | 100% | 67.8 |

**Amenities** (OpenStreetMap extract of 3 Oct 2026; confidence 0.85).

| Key | Value |
|---|---|
| `amenities.total` | 429 |
| `amenities.restaurants_cafes` | 117 |
| `amenities.parks_leisure` | 125 |
| `amenities.pubs_bars` | 40 |
| `amenities.shops` | 38 |
| `amenities.healthcare` | 31 |

**Transport** (NaPTAN, 3 Oct 2026; confidence 0.9).

| Key | Value |
|---|---|
| `transport.stations` | 9 within 2 km |
| `transport.bus_stops` | 23 within 500 m |

**Environment** (Environment Agency).

| Key | Value | Period |
|---|---|---|
| `environment.flood_areas_nearby` | 20 flood risk areas within 3 km | list of 5 Oct 2026, confidence 0.9 |
| `environment.active_flood_warnings` | 0 | checked live at request time, 12 Oct 2026, confidence 0.9 |

### 3.5 The same place at three grains

The `grain` parameter reads the same postcode as its neighbourhood, its group of neighbourhoods, or its whole district. Aggregates are served for crime, the one category where summing is meaningful, and carry no percentile.

```
GET /v1/area?postcode=SE15 5DP&grain=group
GET /v1/area?postcode=SE15 5DP&grain=district
```

| Grain | Place | Neighbourhoods | Recorded crimes, 12 months | Per 1,000 residents |
|---|---|---|---|---|
| neighbourhood | Southwark 022E, `oga_pl_YXC6XP2HFFQEA` | 1 | 1,619 | 731.9 |
| group | Southwark 022, `oga_pl_3X4K57N4FSMRH` | 6 | 2,865 | 325.1 |
| district | Southwark, `oga_pl_QGEC3RD3KKH89` | 185 | 49,295 | 160.2 |

The `geo` block at the coarser grains carries `place_type: "group"` or `"district"` and `neighbourhood_count`, and `meta.grain` says which grain answered.

### 3.6 The same request in three nations

The contract does not change across the border; what changes is which publisher answers, and the reason text names it.

**EH8 9YL, Edinburgh (Scotland).** `country: "Scotland"`, `rural_urban: "Large Urban Areas"`.

| Signal | Value | Reason |
|---|---|---|
| `crime.total_12m`, `crime.rate_per_1000` | null, confidence 0 | "police.uk publishes no street-level crime for Scotland." |
| `crime.council_rate` | 744 per 10,000, confidence 0.3 | "Council-area recorded crime rate for City of Edinburgh (2025/2026); council-level context, not street-level and not used in the safety score." Source Police Scotland |
| `deprivation.imd_decile` | 2 (15th percentile in Scotland), rank 1,059 of 6,976 | "SIMD 2020: the official index for this neighbourhood." |
| Domains | income 3, employment 2, health 2, education 2, crime 1, access to services 7, housing 1 | |
| `property.median_price` | null | "No HM Land Registry coverage for this area." |
| `schools.*` | null | "School-quality ratings are not currently available for Scotland: Education Scotland inspects on a sample basis, so national coverage is partial." |
| `amenities.total` | 1,089 | OpenStreetMap |
| `transport.stations` | 7 | NaPTAN |
| `environment.active_flood_warnings` | null | "SEPA: real-time flood warnings are not included in this response; check SEPA for warnings in force." |

**CF10 1EP, Cardiff city centre (Wales).** `area_type: "suburban"`, `rural_urban: "Urban: Nearer to a major town or city"`.

| Signal | Value | Reason |
|---|---|---|
| `crime.total_12m` | 5,886 (99.97th percentile in Wales), confidence 1 | "5,886 recorded crimes over 12 months, a robust sample." |
| `crime.rate_per_1000` | 2,238.9 | A city-centre neighbourhood with few residents |
| `deprivation.imd_decile` | 6, rank 1,062 of 1,917 | "WIMD 2025: the official index for this neighbourhood." Released 27 Nov 2025 |
| Domains | income 9, employment 9, health 10, education 6, access to services 4, housing 3, community safety 1, physical environment 1 | |
| `property.median_price` | £150,000 (14th percentile in Wales), confidence 0.9 | From 38 sales in the group (MSOA W02000398) |
| `property.transaction_count` | 28, confidence 0.6 | "28 sales in the period, a moderate sample; treat the figure as indicative." |
| `schools.*` | null | "School-quality ratings are not available for Wales: Estyn (the national inspectorate) discontinued comparable overall inspection grades in 2022, so there is no like-for-like measure." |
| `environment.active_flood_warnings` | null | "Natural Resources Wales: real-time flood warnings are not included in this response; check Natural Resources Wales for warnings in force." |

**M1 1AE, Manchester city centre (a publisher gap in England).**

| Signal | Value | Reason |
|---|---|---|
| `crime.total_12m`, `crime.rate_per_1000`, `crime.monthly_rate`, `crime.population` | null, confidence 0 | "No police.uk street-level crime is published for this area (Greater Manchester Police has not supplied data since July 2019); see the Local-Authority figure below." |
| `crime.council_rate` | 1,659 per 10,000, confidence 0.3 | "Local-Authority recorded crime rate for Manchester (Apr 2023 to Mar 2024); Local-Authority level context, not street-level and not used in the safety score." Source Home Office |

The point of these three: a customer's code never has to special-case a nation or a gap. It reads `value`, and if it is null it has a sentence to show.

### 3.7 The schools behind the schools figures

```
GET /v1/area/schools?postcode=SE15 5DP
```

```json
{
  "postcode": "SE15 5DP", "lsoa": "E01004067", "country": "England",
  "inspectorate": "Ofsted", "radius_m": 1500, "distance_from": "neighbourhood_centroid",
  "school_count": 28,
  "schools": [
    { "urn": 100881, "name": "Cherry Garden School", "phase": "Special",
      "overall_effectiveness": null, "rating": null, "grade_source": null, "inspection_date": null, "distance_m": 256 },
    { "urn": 100825, "name": "St James the Great Roman Catholic Primary School", "phase": "Primary",
      "overall_effectiveness": 2, "rating": "Good", "grade_source": "ungraded_inspection", "inspection_date": "2022-10-12", "distance_m": 380 },
    { "urn": 134225, "name": "Harris Academy Peckham", "phase": "Secondary",
      "overall_effectiveness": 1, "rating": "Outstanding", "grade_source": "quality_of_education", "inspection_date": "2025-02-11", "distance_m": 399 }
  ],
  "meta": { "engine_version": "1.12.5", "fetch_mode": "store" }
}
```

Every state-funded school in England is included, graded or not. The grade is the most recent judgement that names one, and `grade_source` says where it came from: a new-style report card, an overall effectiveness judgement, a quality of education judgement, or an ungraded inspection that confirmed the school "remains Good". A school with no grade yet is listed with nulls, which is why the profile distinguishes `total_count` (28) from `rated_count` (25).

### 3.8 The sales behind the property figures

```
GET /v1/area/transactions?postcode=SE15 5DP
```

```json
{
  "postcode_area": "SE15",
  "place": { "place_id": "oga_pl_YXC6XP2HFFQEA", "place_type": "neighbourhood" },
  "period": { "from": "2025-11-13", "to": "2026-07-22" },
  "transaction_count": 6,
  "transactions": [
    { "date": "2026-07-22", "price": 250000, "property_type": "Flat", "estate_type": "leasehold" },
    { "date": "2026-06-10", "price": 230000, "property_type": "Flat", "estate_type": "leasehold" },
    { "date": "2026-06-08", "price": 300000, "property_type": "Terraced", "estate_type": "freehold" },
    { "date": "2025-12-16", "price": 640000, "property_type": "Flat", "estate_type": "leasehold" },
    { "date": "2025-11-27", "price": 230000, "property_type": "Flat", "estate_type": "leasehold" },
    { "date": "2025-11-13", "price": 520000, "property_type": "Terraced", "estate_type": "freehold" }
  ],
  "meta": { "fetch_mode": "store" }
}
```

No address fields are served. Six sales ranging from £230,000 to £640,000 is exactly why the neighbourhood's own median is not used: the inherited group median of £500,000 from 43 sales is the better estimate, and the response makes both visible.

### 3.9 Ranked lists

`GET /v1/areas` turns the store into a query: every neighbourhood ranked by one signal, filtered by nation, district, value or percentile.

**The lowest crime rates in Southwark (district code E09000028), bottom fifth nationally, by value:**

```
GET /v1/areas?signal=crime.rate_per_1000&country=England&lad=E09000028&max_percentile=20&sort=value&limit=5
```

```json
{
  "signal": "crime.rate_per_1000",
  "count": 3,
  "areas": [
    { "geo_type": "lsoa", "geo_code": "E01004073", "value": 35.4, "percentile": 16.56,
      "period": { "start": "2025-09-01", "end": "2026-08-31" }, "period_basis": "reference", "loaded_at": "2026-10-01T10:54:39.905Z" },
    { "geo_type": "lsoa", "geo_code": "E01032638", "value": 37.2, "percentile": 18.59, "...": "..." },
    { "geo_type": "lsoa", "geo_code": "E01003954", "value": 38.3, "percentile": 19.74, "...": "..." }
  ]
}
```

Only three of Southwark's 185 neighbourhoods sit in England's lowest fifth for crime per resident. The same borough contains SE15 5DP at the 99th percentile.

**The highest median prices in Wales above £350,000:**

```
GET /v1/areas?signal=property.median_price&country=Wales&min_value=350000&sort=value_desc&limit=5
```

The top rows are W01001799, W01001794 and W01001778, all at £514,500 and the 99.9th percentile: three neighbourhoods in one group, carrying the group's inherited median. The inherited rule is visible in a ranked list too.

### 3.10 The catalogue endpoint

```
GET /v1/signals/metadata
```

Returns every key grouped by category, each with `label`, `unit`, `direction`, `source`, `methodology_version`, `visibility` (`public` or `internal`) and `plannable`. A product uses it to build a picker, to validate a bundle before saving it, or to label a column without hard-coding anything.

```json
{
  "signals": {
    "property": [
      { "key": "property.median_price", "label": "Median sale price", "unit": "GBP", "direction": "neutral",
        "source": "ONS HPSSA", "methodology_version": "1.12.5", "visibility": "public", "plannable": true },
      { "key": "property.price_change_pct", "label": "Price change (year on year)", "unit": "pct", "direction": "neutral",
        "source": "ONS HPSSA", "methodology_version": "1.12.5", "visibility": "public", "plannable": true },
      { "key": "property.transaction_count", "label": "Sales in the year", "unit": "count", "direction": "neutral",
        "source": "HM Land Registry Price Paid Data", "methodology_version": "1.12.5", "visibility": "public", "plannable": true },
      { "key": "property.median_price_peer_relative_z", "label": "Median sale price against the 20 most similar areas (z-score)", "unit": "z_score", "direction": "neutral",
        "source": "ONS HPSSA, derived", "methodology_version": "1.12.5", "visibility": "public", "plannable": true }
    ],
    "crime": [ "..." ], "deprivation": [ "..." ], "schools": [ "..." ], "amenities": [ "..." ], "transport": [ "..." ], "environment": [ "..." ]
  }
}
```

### 3.11 Sorting by date

```
GET /v1/area?postcode=SE15 5DP&sort=period
```

The same 65 signals, ordered by the end of the period they describe, most recent first: the live flood-warning check (12 Oct 2026) comes first, then the deprivation domains loaded on 10 Oct, then amenities and transport (3 to 5 Oct), crime (window ending 31 Aug), schools (register as at 31 Aug), property (year ending 31 Mar 2026) and finally the Census population (21 Mar 2021). `sort=loaded` and `sort=released` order by the other two dates.

---
## 4. Scores

### 4.1 What Scores is

Scores turns the facts into a judgement for a stated purpose: one number from 0 to 100, built from seven dimensions, each with its own score, weight, confidence and a sentence of reasoning that names the data behind it. The purpose is declared up front as a **preset** (moving, business, investing, research) or as the customer's own weights, so two customers with different questions get different scores from the same facts, and both can see exactly why.

Three design rules make a Score something a regulated buyer can put in front of a committee:

1. **Deterministic.** The same place, the same preset and the same engine version always give the same number. No model is involved anywhere in the scoring path.
2. **Explained from the data.** Every dimension's reasoning is generated from the actual values and says what they are and where they came from. Where narrative exists (the `explain` option), it is written after the numbers are fixed and cannot change them.
3. **Ranked among like places.** Transport, schools and amenities are not scored against a fixed scale but by where the place ranks among neighbourhoods of the same kind (urban, suburban or rural), so a village is not punished for lacking a tube station. A customer can replace the national band with its own set of places (a cohort, section 7.4).

### 4.2 The seven dimensions

| Dimension | Built from | How it is scored |
|---|---|---|
| Crime | `crime.monthly_rate`, the violence share, the 12-month trend | A curve over the monthly rate, adjusted for the share of violent crime and the trend |
| Deprivation | `deprivation.imd_decile` | The published decile, mapped linearly (decile 1 scores low, decile 10 scores high). For the business preset, read as spending power |
| Property | `property.median_price`, `property.price_change_pct` | Depends on the preset: affordability against the national median for moving and research; a cost proxy for business; the average of price growth and an inferred rental yield for investing |
| Schools | Graded schools within 1.5 km, weighted by grade | Rank among neighbourhoods of the same band |
| Amenities | The six amenity counts | Rank among neighbourhoods of the same band |
| Transport | Stations within 2 km, bus stops within 500 m | Rank among neighbourhoods of the same band; stations add with diminishing returns |
| Environment | `environment.flood_areas_nearby`, active warnings, parks and green space | Flood exposure ranked among the nation's neighbourhoods, the least exposed highest; adjusted for green space and live warnings |

Every preset scores all seven. The preset changes only the weights.

### 4.3 The four presets and their weights

| Preset | Intended workflow | Crime | Deprivation | Property | Schools | Amenities | Transport | Environment |
|---|---|---|---|---|---|---|---|---|
| `moving` | Residential origination: where a household settles | 20 | 10 | 20 | 20 | 10 | 15 | 5 |
| `business` | Commercial site selection | 5 | 15 | 15 | 5 | 25 | 20 | 15 |
| `investing` | Investment underwriting | 10 | 10 | 30 | 5 | 15 | 15 | 15 |
| `research` | A neutral reference baseline | 15 | 15 | 14 | 14 | 14 | 14 | 14 |

A caller can also pass its own `weights` (any subset of the seven, positive numbers, the engine normalises them) or a saved organisation preset by `preset_id` (section 7.3). The response says which applied in `weights_source`: `preset` or `custom`.

### 4.4 Confidence, and what happens when a source is missing

Each dimension carries a confidence: 1.0 (high), 0.7 (medium), 0.4 (low) or 0.2 (none). The overall confidence is the weight-averaged mean.

When a source is genuinely absent (no street-level crime in Scotland, no Ofsted grades for a request whose bundle leaves schools out), the dimension is scored at the **neutral midpoint, 50, with confidence 0.2**, and its reasoning says so in words. The missing source neither rewards nor punishes the place; it simply contributes nothing, visibly. This is the difference between "no school nearby" and "no school data", and the engine never confuses the two.

### 4.5 The reference set

The `reference` field in every response says what the place was ranked against.

| `reference.kind` | Meaning | Example |
|---|---|---|
| `band` | All neighbourhoods in Great Britain of the same kind | `{ "kind": "band", "band": "urban" }` |
| `cohort` | The customer's own set of at least 30 places (section 7.4) | `{ "kind": "cohort", "slug": "northern-book", "name": "Northern lending book", "areas": 412 }` |
| `national` | All of Great Britain, used only when a place has no official rural-urban class | `{ "kind": "national", "scope": "GB", "reason": "area_type_unavailable" }` |

The band comes from the official rural-urban classification of the place's postcodes: `urban` (major conurbations and Scotland's large urban areas), `suburban` (other urban areas), `rural`. It is never guessed.

### 4.6 The endpoint

```
POST /v1/score
{
  "area": "SE15 5DP",          // postcode or place name (required)
  "preset": "moving",          // or "weights": {...}, or "preset_id": "spr_..."
  "explain": true,             // adds summary, recommendations and data_sources
  "cohort": "northern-book",   // optional: rank against your cohort instead of the band
  "bundle": "bndl_..."         // optional: restrict the signals the score may use
}
```

Response fields: `area`, `preset`, `score` (0 to 100), `area_type`, `rural_urban`, `dimensions[]` (each with `key`, `label`, `score`, `weight`, `confidence`, `reasoning`, `confidence_reason`), `confidence`, `weights_source`, `reference`, `engine_version`, and with `explain`: `summary`, `recommendations[]`, `data_sources[]`.

### 4.7 Worked example: SE15 5DP for someone moving

```
POST /v1/score?explain=true
{ "area": "SE15 5DP", "preset": "moving" }
```

```json
{
  "area": "SE15 5DP",
  "preset": "moving",
  "score": 53,
  "area_type": "urban",
  "rural_urban": "Urban major conurbation",
  "dimensions": [
    {
      "key": "crime", "label": "Crime", "score": 26, "weight": 20, "confidence": 1,
      "reasoning": "1,619 crimes over 12 months (135/month); most common: anti-social behaviour (26%); violent crime: 23% of total; trend: stable",
      "confidence_reason": "police.uk: 1,619 recorded crimes over 12 months, a robust sample."
    },
    {
      "key": "deprivation", "label": "Deprivation", "score": 23, "weight": 10, "confidence": 1,
      "reasoning": "IMD 2025 decile 2/10 (high deprivation). Ranked 6,010 of 33,755 LSOAs (18th percentile)",
      "confidence_reason": "Based on IMD 2025, the current English release"
    },
    {
      "key": "property", "label": "Property", "score": 25, "weight": 20, "confidence": 1,
      "reasoning": "Median sale price £500,000 (ONS rolling-year median for the neighbourhood group): above national average, higher living costs",
      "confidence_reason": "ONS HPSSA: rolling-year median for the neighbourhood group this area belongs to (MSOA E02000828), from 43 sales in the year. Every neighbourhood in the group carries it"
    },
    {
      "key": "schools", "label": "Schools", "score": 90, "weight": 20, "confidence": 1,
      "reasoning": "25 Ofsted-rated schools within 1.5km (3 Outstanding, 21 Good, 1 Requires Improvement); 3 more not yet graded. 18 additional educational facilities nearby; ranks at the 95th percentile of urban neighbourhoods",
      "confidence_reason": "Ofsted: 25 of 28 schools within 1.5km carry a grade (inspections Jan 2020 to Jan 2026), a robust sample."
    },
    {
      "key": "amenities", "label": "Amenities", "score": 87, "weight": 10, "confidence": 1,
      "reasoning": "429 amenities nearby: 46 schools, 157 food/drink, 31 healthcare, 38 shops, 125 parks/leisure; ranks at the 91st percentile of urban neighbourhoods",
      "confidence_reason": "429 amenities provide a rich, multi-category signal"
    },
    {
      "key": "transport", "label": "Transport", "score": 83, "weight": 15, "confidence": 1,
      "reasoning": "9 rail/tube stations within 2km; 23 bus stops within 500m; nearby: Peckham Rye station, Queens Road Peckham station, Nunhead station. Stations rank at the 85th percentile and bus stops at the 87th of urban neighbourhoods",
      "confidence_reason": "9 named stations and 23 bus stops from NaPTAN"
    },
    {
      "key": "environment", "label": "Environment", "score": 18, "weight": 5, "confidence": 1,
      "reasoning": "20 flood risk areas within 3km of the neighbourhood's centre; no active warnings; 125 parks/green spaces nearby; flood exposure ranks at the 4th percentile of English neighbourhoods, the least exposed highest",
      "confidence_reason": "Environment Agency flood and OpenStreetMap green-space data both available"
    }
  ],
  "confidence": 1,
  "weights_source": "preset",
  "reference": { "kind": "band", "band": "urban" },
  "engine_version": "1.12.5",
  "summary": "53/100: mixed for an urban area, with high confidence. Strongest on Schools (90/100); weakest on Environment (18/100).",
  "recommendations": [
    "Environment scores 18/100. 20 flood risk areas within 3km of the neighbourhood's centre; no active warnings; 125 parks/green spaces nearby; flood exposure ranks at the 4th percentile of English neighbourhoods, the least exposed highest",
    "Deprivation scores 23/100. IMD 2025 decile 2/10 (high deprivation). Ranked 6,010 of 33,755 LSOAs (18th percentile)",
    "Property scores 25/100. Median sale price £500,000 (ONS rolling-year median for the neighbourhood group): above national average, higher living costs",
    "Crime scores 26/100. 1,619 crimes over 12 months (135/month); most common: anti-social behaviour (26%); violent crime: 23% of total; trend: stable"
  ],
  "data_sources": ["MHCLG IMD 2025", "police.uk crime archive", "OpenStreetMap", "Environment Agency flood data", "HM Land Registry Price Paid", "Ofsted school inspections (DfE)"]
}
```

How to read it: Peckham scores 53 for a household moving in. Schools (90), amenities (87) and transport (83) are excellent for an urban neighbourhood; crime (26), deprivation (23) and property affordability (25) pull it down; flood exposure (18) is the weakest dimension but carries only 5% of the weight for this purpose. Every sentence in the reasoning can be checked against the Signals profile in section 3.4.

### 4.8 The same place, three purposes

| Request | Score | Why it moved |
|---|---|---|
| `preset: "moving"` | 53 | Weights as above |
| `preset_id` of the organisation's saved "Investment underwrite" preset (base `investing`) | 58 | Property is now 30% of the weight and is scored on growth and yield rather than affordability, so the £500,000 median with +20.5% growth scores 67 instead of 25; `weights_source: "custom"` |
| `weights: { crime: 40, deprivation: 10, property: 10, schools: 5, amenities: 15, transport: 15, environment: 5 }` | 46 | A safety-first customer puts 40% on crime; crime scores 26, so the composite falls |

The seven dimension scores are identical in all three responses (crime 26, deprivation 23, schools 90, amenities 87, transport 83, environment 18; property 25 or 67 depending on the preset's property rule). Only the weights and the property rule change. That is the deterministic engine doing exactly what the preset asks.

### 4.9 A rural example: LA22 0EN for an investor

```
POST /v1/score
{ "area": "LA22 0EN", "preset": "investing" }
```

Score **60**, `area_type: "rural"`, `rural_urban: "Smaller rural: Further from a major town or city"`, overall confidence 0.88, reference `{ "kind": "band", "band": "rural" }`.

| Dimension | Score | Weight | Confidence | Reasoning (abridged) |
|---|---|---|---|---|
| Crime | 70 | 10 | 1.0 | 127 crimes over 12 months (11/month); most common: violence and sexual offences (46%); trend: rising |
| Deprivation | 77 | 10 | 1.0 | IMD 2025 decile 8/10 (low deprivation). Ranked 23,645 of 33,755 LSOAs (70th percentile) |
| Property | 32 | 30 | 0.85 | Prices down 14.1% year on year (£415,870, ONS rolling-year median for the neighbourhood group): declining, potential buying opportunity or risk |
| Schools | 30 | 5 | 0.4 | 1 Ofsted-rated school within 1.5km (1 Requires Improvement); ranks at the 28th percentile of rural neighbourhoods. Confidence reason: "1 graded school within 1.5km, too few for a reliable share of Good or Outstanding; the share is served but not ranked" |
| Amenities | 85 | 15 | 1.0 | 92 amenities nearby: 5 schools, 61 food/drink, 4 healthcare, 3 shops, 11 parks/leisure; ranks at the 88th percentile of rural neighbourhoods |
| Transport | 50 | 15 | 0.7 | 0 rail/tube stations within 2km; 8 bus stops within 500m. Stations rank at the 39th percentile and bus stops at the 62nd of rural neighbourhoods |
| Environment | 90 | 15 | 1.0 | 4 flood risk areas within 3km; no active warnings; 11 parks/green spaces nearby; flood exposure ranks at the 84th percentile of English neighbourhoods, the least exposed highest |

Two things to notice. Ambleside's 92 amenities rank at the 88th percentile **of rural neighbourhoods**; against urban London they would rank nowhere, and that would be the wrong comparison. And the schools dimension carries confidence 0.4 with the reason written out: one graded school is not enough to rank the area on, and the response says so instead of pretending.

### 4.10 A Scottish example: EH8 9YL for an investor

Score **73**, confidence 0.7. The crime dimension reads:

```json
{
  "key": "crime", "score": 50, "weight": 10, "confidence": 0.2,
  "reasoning": "police.uk publishes no street-level crime for Scotland. Scored at the neutral midpoint, 50, with no crime data behind it",
  "confidence_reason": "police.uk publishes no street-level crime for Scotland"
}
```

Deprivation reads "SIMD 2020 decile 2/10 (high deprivation). Ranked 1,059 of 6,976 Scottish Data Zones (15th percentile)" at confidence 0.7, because the Scottish index dates from 2020. Transport scores 86 ("7 rail/tube stations within 2km; 61 bus stops within 500m; nearby: Edinburgh Waverley station"). Environment scores 73 from SEPA's maps ("2 of 6 SEPA flood maps (river, surface water and coastal; high or medium likelihood) within 250m of the neighbourhood's centre"). The engine never invents a Scottish crime figure to fill the gap; it scores the midpoint, marks it, and lets the reader weigh it.

### 4.11 Scoring many places at once

- **Portfolio enrichment** (Monitor): `POST /v1/portfolios/{id}/enrich` with a `preset` scores every place in a portfolio in one call.
- **Compare** (Intelligence and MCP): the `compare_areas` plan returns full profiles for 2 to 5 places side by side; the MCP tool `compare_postcodes` scores up to 8 for the same preset and returns a sorted table.
- **Score inside a query**: the `score_area` plan op scores a place from within the Intelligence query plane.

---

## 5. Monitor

### 5.1 What Monitor is

Monitor watches a customer's own book of places and tells them what moved, by how much, and why. A lender holds a portfolio of security addresses; an insurer a book of risks; a retailer its estate; a platform the places its users follow. Monitor keeps those places by permanent id, enriches them with Scores, diffs each refresh against the last, and delivers the changes as a feed, as a probe, and as signed webhooks.

The feature that sets it apart is the **cause**. Because every methodology release records which signals it affects (section 2.7), Monitor can say of every change whether it happened because the world changed (`source`), because the method changed (`method`), or both (`source_and_method`). A customer who sees a school count double can tell at once whether more schools were graded or whether the engine started counting differently.

### 5.2 Portfolios

A portfolio is a named list of places. Places are added as whatever the customer holds (postcodes, codes, place ids) with an optional label, and each is stored with its resolved permanent `place_id`.

```
POST /v1/portfolios
{ "name": "Northern lending book" }

POST /v1/portfolios/pf_1791234567890_k3m9qa/areas
{ "areas": [
    { "area": "SE15 5DP", "label": "Peckham" },
    { "area": "BS1 4DJ", "label": "Bristol harbourside" },
    { "area": "GU2 7UP", "label": "Guildford" },
    { "area": "YO1 7HH", "label": "York" }
] }
```

```
GET /v1/portfolios/pf_1791234567890_k3m9qa
```

```json
{
  "id": "pf_1791234567890_k3m9qa",
  "name": "Northern lending book",
  "area_count": 4,
  "created_at": "2026-09-23T18:20:29.186Z",
  "areas": [
    { "id": "pfa_1791234567891_a1b2c3", "area": "SE15 5DP", "label": "Peckham", "place_id": "oga_pl_YXC6XP2HFFQEA" },
    { "id": "pfa_1791234567892_d4e5f6", "area": "BS1 4DJ", "label": "Bristol harbourside", "place_id": "oga_pl_SDZRTQ7E051XR" },
    { "id": "pfa_1791234567893_g7h8i9", "area": "GU2 7UP", "label": "Guildford", "place_id": "oga_pl_01DYGB7N99RR7" },
    { "id": "pfa_1791234567894_j0k1l2", "area": "YO1 7HH", "label": "York", "place_id": "oga_pl_7E7YT1RGSWR26" }
  ]
}
```

Portfolios can be listed, renamed, deleted, and places removed one at a time.

### 5.3 Bulk mapping: bringing a book in

Most books are large. Two endpoints take a customer's raw list and return places with their stored signals:

- `POST /v1/places/map` takes up to 1,000 inputs synchronously, optionally adding them to a portfolio (`portfolio_id`), and returns one row per input with its place, its signals and a summary of what resolved and what did not.
- `POST /v1/jobs/portfolio-map` takes up to 20,000 inputs as a job. It returns a job id immediately; `GET /v1/jobs/{id}` reports progress and `GET /v1/jobs/{id}/rows` pages through the results (up to 1,000 rows a page) when done.

Inputs can be a mix of live postcodes, retired postcodes, official codes and place ids. Northern Ireland postcodes and unrecognised strings come back as not found with a reason, never dropped.

### 5.4 Enrichment

```
POST /v1/portfolios/pf_1791234567890_k3m9qa/enrich
{ "preset": "investing" }
```

Returns a full Score (section 4) for every place in the portfolio, as `results[]` with `area`, `label`, `score` and, where a place could not be scored, an `error` for that row alone.

### 5.5 Change detection: the probe

```
GET  /v1/portfolios/{id}/changes?cause=source,method      // read-only probe, never fires webhooks
POST /v1/portfolios/{id}/changes                          // the same check; fires signal.changed webhooks
{ "baseline": "previous", "threshold_pct": 5, "min_transactions": 8, "cause": ["source", "method", "source_and_method"] }
```

The check compares each place's current values with a baseline: `previous` (the period before) or `first` (the first period on record). A move is **material** when its percentage change is at least `threshold_pct` (default 5). Property medians are additionally gated on `min_transactions` (default 8) sales in both periods, so a thin-sample wobble is not reported as a market move.

A real probe of a ten-place portfolio on 12 October 2026 returned 38 material changes. Three of them:

```json
{
  "portfolio_id": "pf_1790187000000_demo10",
  "baseline": "previous", "threshold_pct": 5, "min_transactions": 8,
  "areas_checked": 10, "material_count": 38,
  "causes": ["source", "method", "source_and_method"],
  "changes": [
    {
      "signal_key": "crime.monthly_count", "label": "Recorded crimes in month",
      "area": "GU2 7UP", "geo_code": "E01030468",
      "period_from": "2026-07-01 to 2026-07-31", "period_to": "2026-08-01 to 2026-08-31",
      "value_from": 16, "value_to": 17, "delta": 1, "pct_change": 6.25, "direction": "up",
      "material": true, "cause": "source", "method_releases": [],
      "engine_version_from": "1.12.2", "engine_version_to": "1.12.2"
    },
    {
      "signal_key": "crime.monthly_count", "label": "Recorded crimes in month",
      "area": "SE15 5DP", "geo_code": "E01004067",
      "period_from": "2026-07-01 to 2026-07-31", "period_to": "2026-08-01 to 2026-08-31",
      "value_from": 175, "value_to": 160, "delta": -15, "pct_change": -8.57, "direction": "down",
      "material": true, "cause": "source", "method_releases": [],
      "engine_version_from": "1.12.2", "engine_version_to": "1.12.2"
    },
    {
      "signal_key": "schools.good_count", "label": "Schools rated Good",
      "area": "SE15 5DP", "geo_code": "E01004067",
      "period_from": "2026-07-31", "period_to": "2026-08-31",
      "value_from": 10, "value_to": 21, "delta": 11, "pct_change": 110, "direction": "up",
      "material": true, "cause": "source_and_method", "method_releases": ["1.7.0", "1.8.1"],
      "engine_version_from": "1.3.0", "engine_version_to": "1.8.1"
    }
  ],
  "generated_at": "2026-10-12T15:52:13.956Z"
}
```

The third change is the cause doing its work. Schools rated Good in Peckham went from 10 to 21. Part of that is new data (a new register month), and part is method: release 1.7.0 started counting every state-funded school with a current grade from its most recent judgement, and 1.8.1 changed how coverage is treated. The response names both releases, so the customer's analyst does not spend an afternoon looking for eleven new schools.

### 5.6 The change feed

The feed is the authoritative, cursor-paged record of every stored value that a completed refresh changed for the places a portfolio holds. Where the probe compares two periods on demand, the feed is written by the refresh pipeline itself and reaches back as far as the refresh ledger is kept (30 days).

```
GET /v1/portfolios/{id}/feed?since=2026-09-12T00:00:00Z&limit=200&threshold_pct=5&min_confidence=0&cause=source
```

Each entry carries the place, the customer's own labels for it, the signal, the refresh run that produced it, the full dating of the new value, the value **before** and **after** with their confidence and national decile band, the delta, and three flags: `value_moved`, `confidence_dropped`, `band_crossed`.

```json
{
  "portfolio_id": "pf_1790187000000_demo10",
  "since": "2026-09-12T15:52:14.615Z",
  "threshold_pct": 5, "min_confidence": 0,
  "causes": ["source", "method", "source_and_method"],
  "places_held": 10, "areas_without_place": 0,
  "entries": [
    {
      "cursor": 2248467,
      "place": { "place_id": "oga_pl_YXC6XP2HFFQEA", "place_type": "neighbourhood", "name": "Southwark 022E", "country": "GB", "nation": "GB-ENG" },
      "areas": ["SE15 5DP"],
      "signal_key": "property.median_price", "category": "property", "label": "Median sale price", "unit": "GBP", "direction": "neutral",
      "run": { "id": "run_1789546886608_i1fl3hyc51l", "source": "hpssa", "completed_at": "2026-09-16T08:23:44.327Z" },
      "observed_period": "2025-04-01 to 2026-03-31",
      "period": { "start": "2025-04-01", "end": "2026-03-31" }, "period_basis": "reference",
      "released_at": "2026-09-17", "loaded_at": "2026-10-03T13:54:58.601Z",
      "recorded_at": "2026-09-16T08:23:35.882Z",
      "before": { "period": "2025-12-01 to 2025-12-31", "value": 640000, "confidence": 0.4, "band": null },
      "after":  { "period": "2025-04-01 to 2026-03-31", "value": 500000, "confidence": 0.9, "band": 9 },
      "delta": -140000, "pct_change": -21.87, "movement": "down",
      "flags": { "value_moved": true, "confidence_dropped": false, "band_crossed": false },
      "cause": "source", "method_releases": [],
      "engine_version_from": "1.12.2", "engine_version_to": "1.12.0"
    }
  ],
  "successions": [],
  "next_after": 2266121,
  "complete_through": "2026-09-16T08:23:38.719Z",
  "notes": [
    "An entry is a stored signal of a held place that a completed refresh changed since the given instant, kept when the value moved by at least threshold_pct at or above min_confidence, the confidence fell, or the national decile changed.",
    "before is the value this one replaced: the same period's earlier value when the period was restated, otherwise the period before; a first observation has no before and is not a change.",
    "cause says why it moved: source (the world or its publisher), method (a methodology release, same period) or source_and_method (both); method_releases names the releases.",
    "The feed reaches as far back as the refresh ledger is kept. Successions are listed on the first page only."
  ],
  "meta": { "engine_version": "1.12.5", "generated_at": "2026-10-12T15:52:14.615Z" }
}
```

This single entry tells a complete story. Peckham's median price was £640,000 at confidence 0.4 (a December month with a handful of sales). The ONS year-ending-March-2026 edition arrived and replaced it with £500,000 at confidence 0.9, in the ninth national decile. The value moved down 21.9%, but the confidence went up, and the band did not cross. Cause: source. A customer's rule engine can act on any of those fields.

The `notes` array is part of every feed response, so the semantics travel with the data. `successions` lists any held place that a census redraw retired, with its successors and shares. `next_after` is the cursor for the next page; `complete_through` says how far the pipeline has written.

### 5.7 Webhooks

Two event types, each with a signed payload, retried on failure.

| Event | When it fires | Payload |
|---|---|---|
| `signal.changed` | When a customer runs `POST /v1/portfolios/{id}/changes` and a material move is found | The change record from section 5.5, plus `portfolio_id` |
| `portfolio.feed` | After each refresh, one event per new feed entry for the portfolios the customer holds, behind a forward-only watermark so nothing is delivered twice | The feed entry from section 5.6, plus `portfolio_id` |

```
POST /v1/webhooks
{
  "url": "https://example.com/hooks/onegoodarea",
  "events": ["portfolio.feed", "signal.changed"],
  "causes": ["source", "method", "source_and_method"]
}
```

```json
{
  "id": "whsub_1791234567890_x9y8z7",
  "url": "https://example.com/hooks/onegoodarea",
  "events": ["portfolio.feed", "signal.changed"],
  "causes": ["source", "method", "source_and_method"],
  "secret": "whsec_...",
  "created_at": "2026-10-12T16:02:11.000Z"
}
```

- A subscription chooses which **causes** it wants. The default is `source` only, so a customer who wants to be told about method changes asks for them explicitly.
- Every delivery is an envelope `{ "id": "evt_...", "type": "portfolio.feed", "created": ..., "data": {...} }` with an HMAC-SHA256 signature over the timestamp and body in the `X-OneGoodArea-Signature` header (`t=<timestamp>,v1=<signature>`), the event type in `X-OneGoodArea-Event` and a delivery id in `X-OneGoodArea-Delivery`.
- Endpoints must be HTTPS. Failed deliveries are retried twice, after one minute and then ten minutes.
- The secret can be rotated at any time (`POST /v1/webhooks/{id}/rotate-secret`); subscriptions are listed and deleted through `GET` and `DELETE /v1/webhooks`.

### 5.8 Through the MCP server

The same product is reachable by an AI agent through two tools: `watch_portfolio(name, areas)` creates a portfolio and adds up to 100 places in one step, and `get_portfolio_changes(portfolio_id, threshold_pct?, baseline?, min_transactions?, cause?)` runs the change check and returns a table of material moves. Section 8 covers the server.

---
## 6. Intelligence

### 6.1 What Intelligence is, and what it is not

Intelligence is the query plane over the whole store. Where Signals answers "tell me about this place", Intelligence answers "which places?", "which places are like this one?", "which places are behaving unlike their peers?", and "where is this signal heading?".

It is **not a chatbot** and it does not write narrative. Its centre is a **typed query plan**: a small JSON grammar of seven operations that the store knows how to execute. A programmatic caller posts a plan and no language model is involved at any point. A caller who prefers plain English posts a question instead; a planner translates it into a plan, the plan is validated against the grammar and the catalogue, and the same executor runs it. In both cases the response returns the plan alongside the results, so every answer carries the exact query that produced it and can be re-run, audited, or edited and run again.

The non-negotiable rule: **AI is interface and planner; it never sets a number.** Every result traces to real store rows.

### 6.2 The plan grammar

A plan is `{ "op": <operation>, "params": {...} }`. Seven operations:

| `op` | What it does | Key parameters |
|---|---|---|
| `rank_areas` | Rank neighbourhoods by one signal, or by several signals combined with AND filters | Singular: `signal`, `country`, `lad`, `sort`, `limit`, `min_percentile`, `max_percentile`, `min_value`, `max_value`. Compound: `signals[]` of `{ key, filter }` (1 to 8), `sort_by { signal, mode, direction }`, `country`, `lad`, `limit` (up to 1,000) |
| `get_area` | The full Signals profile of one place | `area` |
| `score_area` | A Score for one place | `area`, `preset` or `weights` |
| `compare_areas` | Full profiles for 2 to 5 places side by side, one slot per input | `areas[]` |
| `find_peers` | The most similar neighbourhoods | `target`, `signals[]`, `country`, `lad`, `k`, `min_signals` |
| `find_insights` | Outliers against their peers | `signal_key`, `country`, `lad`, `min_abs_z`, `k` |
| `find_forecast` | A projection of one signal at one place | `target`, `signal_key`, `window_months`, `horizon_months` |

A filter takes exactly one operator: `eq`, `lt`, `lte`, `gt`, `gte`, `between: [a, b]` on the raw value, or `percentile_lt`, `percentile_lte`, `percentile_gt`, `percentile_gte`, `percentile_between: [a, b]` on the national percentile. Unknown operations, unknown signals, a percentile filter on a signal the store does not rank, a deprivation ranking with no nation, or a forecast on a signal with no monthly history are all rejected before anything runs.

### 6.3 Posting a plan

**A compound ranking.** Neighbourhoods in Bristol (district code E06000023) in England's lowest quarter for crime per resident, with a median price between £250,000 and £400,000, where at least 80% of graded schools are Good or Outstanding, cheapest first:

```
POST /v1/query
{
  "plan": {
    "op": "rank_areas",
    "params": {
      "signals": [
        { "key": "crime.rate_per_1000",            "filter": { "percentile_lte": 25 } },
        { "key": "property.median_price",          "filter": { "between": [250000, 400000] } },
        { "key": "schools.good_or_outstanding_pct", "filter": { "gte": 80 } }
      ],
      "sort_by": { "signal": "property.median_price", "mode": "value", "direction": "asc" },
      "country": "England",
      "lad": "E06000023",
      "limit": 5
    }
  }
}
```

```json
{
  "plan": { "op": "rank_areas", "params": { "...": "the plan as posted" } },
  "plan_source": "client",
  "results": [
    {
      "geo_type": "lsoa", "geo_code": "E01014705",
      "value": 306250, "percentile": 52.66,
      "period": { "start": "2025-04-01", "end": "2026-03-31" }, "period_basis": "reference", "released_at": "2026-09-17",
      "signals": {
        "crime.rate_per_1000":             { "value": 38.1,   "percentile": 19.48, "period": { "start": "2025-09-01", "end": "2026-08-31" } },
        "property.median_price":           { "value": 306250, "percentile": 52.66, "period": { "start": "2025-04-01", "end": "2026-03-31" } },
        "schools.good_or_outstanding_pct": { "value": 100,    "percentile": 74.47, "period": { "start": "2026-08-31", "end": "2026-08-31" } }
      }
    },
    {
      "geo_type": "lsoa", "geo_code": "E01014680",
      "value": 310000, "percentile": 53.38,
      "signals": {
        "crime.rate_per_1000":             { "value": 28.4,   "percentile": 9.23 },
        "property.median_price":           { "value": 310000, "percentile": 53.38 },
        "schools.good_or_outstanding_pct": { "value": 100,    "percentile": 74.47 }
      }
    }
  ],
  "meta": { "generated_at": "2026-10-12T15:54:26.401Z" }
}
```

Every row carries each listed signal's value, percentile and dated period, so the answer is not just "these neighbourhoods" but "these neighbourhoods, and here is the evidence per criterion". `plan_source: "client"` records that the plan was supplied, not generated.

**A singular ranking.** The most deprived neighbourhoods in Cardiff (W06000015):

```
POST /v1/query
{ "plan": { "op": "rank_areas", "params": { "signal": "deprivation.imd_decile", "country": "Wales", "lad": "W06000015", "sort": "value", "limit": 5 } } }
```

Returns W01001867, W01001753, W01001886, W01001703 and one more, all at decile 1 (the 4.9th percentile in Wales), each dated with WIMD 2025's release of 27 November 2025.

**A score inside the plane.**

```
POST /v1/query
{ "plan": { "op": "score_area", "params": { "area": "EH8 9YL", "preset": "investing" } } }
```

Returns the plan and, as `results`, the full Score response from section 4.10 (73, with crime at the neutral midpoint).

**A side-by-side.**

```
POST /v1/query
{ "plan": { "op": "compare_areas", "params": { "areas": ["SE15 5DP", "LA22 0EN"] } } }
```

Returns `results.areas`, one slot per input, each with the `query` string and the full 65-signal `profile` (or `null` if an input could not be resolved, so a missing entry is visible rather than dropped).

**A rejected plan.** A plan that asks for something the store does not measure is refused with the reason and the valid alternatives, not answered with a substitute:

```
POST /v1/query
{ "plan": { "op": "rank_areas", "params": { "signal": "weather.rainfall_mm", "country": "England", "limit": 5 } } }
```

```json
{
  "error": "Unknown signal: weather.rainfall_mm. Valid signals: amenities.healthcare, amenities.parks_leisure, amenities.pubs_bars, amenities.restaurants_cafes, amenities.shops, amenities.total, crime.anti_social_behaviour_12m, ... property.median_price, property.price_change_pct, property.transaction_count, schools.good_or_outstanding_pct, ...",
  "code": "invalid_signal"
}
```

### 6.4 Asking in plain English

```
POST /v1/query
{ "question": "Which neighbourhoods in Bristol have the lowest crime rate per 1,000 residents?" }
```

The flow:

1. A language model receives the question together with the catalogue of plannable signals and the grammar, and proposes a plan.
2. The plan is validated against the grammar. A question about something the catalogue does not hold (rainfall, broadband speed, council tax bands) comes back as `unsupported_question`, with no attempt at a near miss.
3. The plan is checked against the store: the signals must exist and be plannable, a percentile filter needs ranked data, a forecast needs monthly history. A plan that fails gets one corrected retry.
4. The same deterministic executor runs it, and the response carries `plan_source: "nl"` and the generated plan, so the caller can see exactly how the question was interpreted and can post the plan directly next time.

A place name that matches more than one place returns `ambiguous_location` with the candidates rather than a guess. On the free sandbox, plain-English questions are limited to 10 a month; plan-only calls are ordinary calls.

### 6.5 Peers: places like this one

`POST /v1/peers` finds the neighbourhoods most similar to a target, by distance over normalised signal values. "Similar" is defined by the data, not by geography: two neighbourhoods are peers when their crime, deprivation, property, schools and transport profiles are close, wherever they are.

How it works:

- Each signal is normalised 0 to 1 within the nation (section 2.5). The distance between two neighbourhoods is the root-mean-square difference over the signals both carry, so 0 means identical and 1 means maximally different.
- A candidate must share at least three quarters of the target's signals (and at least `min_signals`, default 3), so a thin profile is not matched on one coincidence.
- Peer-derived signals (the z-scores) and the 1 km school keys are excluded from the comparison so peers are never defined by their own peer measure.
- The caller can restrict the signals compared on (`signals[]`, up to 20), the candidate set (`country`, `lad`, or an organisation's `cohort`), and the number returned (`k`, default 20, up to 200).
- The store keeps a precomputed set of 20 peers for every scored neighbourhood (about 853,000 assignments), refreshed at every refresh; these drive the peer-relative z-score signals.

**Example: the five neighbourhoods most like Peckham.**

```
POST /v1/peers
{ "target": { "postcode": "SE15 5DP" }, "k": 5 }
```

```json
{
  "target": {
    "geo_code": "E01004067",
    "signals_used": [
      "crime.monthly_count_trend_slope_24m", "crime.rate_per_1000", "crime.total_12m", "crime.total_12m_change_pct_yoy",
      "crime.total_6m_change_pct", "deprivation.imd_decile", "deprivation.imd_rank", "property.median_price",
      "schools.good_or_outstanding_pct", "schools.rated_count", "transport.bus_stops", "transport.stations"
    ]
  },
  "peers": [
    { "geo_code": "E01002077", "distance": 0.0313, "n_dims_used": 12, "admin_district": "Haringey",  "region": "London", "sample_postcode": "N17 9AA" },
    { "geo_code": "E01000938", "distance": 0.0430, "n_dims_used": 12, "admin_district": "Camden",    "region": "London", "sample_postcode": "N1 9NL" },
    { "geo_code": "E01002029", "distance": 0.0502, "n_dims_used": 12, "admin_district": "Haringey",  "region": "London", "sample_postcode": "N22 5HF" },
    { "geo_code": "E01003979", "distance": 0.0538, "n_dims_used": 12, "admin_district": "Southwark", "region": "London", "sample_postcode": "SE1 0YA" },
    { "geo_code": "E01000863", "distance": 0.0547, "n_dims_used": 12, "admin_district": "Camden",    "region": "London", "sample_postcode": "NW1 0AP" }
  ],
  "meta": { "scope": "postcode=SE15 5DP -> lsoa=E01004067" }
}
```

Peckham's closest peers on twelve signals are in Tottenham, King's Cross, Wood Green, Borough and Camden Town: inner-London neighbourhoods with high recorded crime, high deprivation, high prices and dense transport. Each peer comes with a sample postcode so a human can look it up.

**Example: choosing the signals.** Ambleside compared on three signals only:

```
POST /v1/peers
{ "target": { "postcode": "LA22 0EN" }, "k": 5, "signals": ["crime.rate_per_1000", "property.median_price", "deprivation.imd_decile"], "min_signals": 2 }
```

The nearest peer is Windermere (LA23 1AA, distance 0.0069), then neighbourhoods in Hertsmere, Thurrock, Stevenage and Milton Keynes: places with the same combination of low crime, high prices and low deprivation, most of them nowhere near the Lake District. Change the signals and the peer set changes with them; that is the point.

### 6.6 Insights: moving unlike their peers

`POST /v1/insights` ranks neighbourhoods by how far a signal sits from the neighbourhood's own twenty peers, in standard deviations (the peer-relative z-score). A high absolute z means the place is behaving unlike the places most similar to it. This is anomaly screening as a query: no judgement, no model, just the store ranked by a stored derived signal.

```
POST /v1/insights
{ "signal_key": "crime.total_12m_peer_relative_z", "country": "England", "k": 5 }
```

```json
{
  "signal_key": "crime.total_12m_peer_relative_z",
  "insights": [
    { "geo_code": "E01035516", "peer_relative_z": 3.9085,  "abs_z": 3.9085 },
    { "geo_code": "E01008857", "peer_relative_z": -3.1397, "abs_z": 3.1397 },
    { "geo_code": "E01035269", "peer_relative_z": 3.0551,  "abs_z": 3.0551 },
    { "geo_code": "E01035514", "peer_relative_z": 3.0154,  "abs_z": 3.0154 },
    { "geo_code": "E01029163", "peer_relative_z": 2.822,   "abs_z": 2.822 }
  ],
  "meta": { "scope": "country=England", "threshold": null }
}
```

The second row is as interesting as the first: a neighbourhood with 3.1 standard deviations **less** crime than its peers. With `min_abs_z` the caller sets a threshold; with `lad` the screen is run on one district. The same query on `property.median_price_peer_relative_z` in Wales with `min_abs_z: 2` returns three neighbourhoods (W01000856 at 2.46, W01001134 at 2.22, W01001815 at 2.20) whose prices sit well above what their peers would suggest.

### 6.7 Forecast: where one signal is heading

`POST /v1/forecast` projects one signal at one place over the coming months. The method is deliberately plain and fully disclosed: a straight-line fit over the trailing window of the monthly time series (default 24 months), projected forward (default 12 months), with a band of two residual standard errors either side, floored at zero. Every point is dated. The response carries the fit statistics so the reader can judge how much to trust it.

```
POST /v1/forecast
{ "target": { "postcode": "SE15 5DP" }, "signal_key": "crime.monthly_count", "horizon_months": 6 }
```

```json
{
  "target": { "geo_code": "E01004067" },
  "signal_key": "crime.monthly_count",
  "points": [
    { "observed_period": "2026-09", "period": { "start": "2026-09-01", "end": "2026-09-30" }, "projected_value": 113.07, "lower_bound": 45.18, "upper_bound": 180.96 },
    { "observed_period": "2026-10", "period": { "start": "2026-10-01", "end": "2026-10-31" }, "projected_value": 109.88, "lower_bound": 41.99, "upper_bound": 177.77 },
    { "observed_period": "2026-11", "period": { "start": "2026-11-01", "end": "2026-11-30" }, "projected_value": 106.69, "lower_bound": 38.80, "upper_bound": 174.58 },
    { "observed_period": "2026-12", "period": { "start": "2026-12-01", "end": "2026-12-31" }, "projected_value": 103.51, "lower_bound": 35.62, "upper_bound": 171.39 },
    { "observed_period": "2027-01", "period": { "start": "2027-01-01", "end": "2027-01-31" }, "projected_value": 100.32, "lower_bound": 32.43, "upper_bound": 168.21 },
    { "observed_period": "2027-02", "period": { "start": "2027-02-01", "end": "2027-02-28" }, "projected_value": 97.13,  "lower_bound": 29.24, "upper_bound": 165.02 }
  ],
  "meta": {
    "scope": "postcode=SE15 5DP -> lsoa=E01004067",
    "window_months": 24, "horizon_months": 6, "n_observations": 24,
    "r2": 0.306, "slope_per_month": -3.19, "intercept": 77644.19, "residual_stderr": 33.94,
    "latest_observed_period": "2026-08", "latest_period": { "start": "2026-08-01", "end": "2026-08-31" }
  }
}
```

Reading it: over the last 24 months Peckham's monthly crime count has fallen by about 3.2 crimes a month per month, from a base in the 130s to a projected 113 in September 2026 and 97 by February 2027. The fit explains about 31% of the variance and the residual error is 34 crimes, so the band is wide: 45 to 181 for September. That width is the honest answer, and the response gives the reader everything needed to decide whether to use it.

A forecast on a signal with too little history is refused rather than extrapolated from two points: `No usable time-series for signal_key=... in the trailing 24 months (need >=2 monthly observations)`.

### 6.8 Through the MCP server

Intelligence is where AI agents meet the platform most directly. `find_areas(question)` posts a plain-English question and returns the generated plan with the results; `find_peers(area, k)` returns the peers table. Section 8 covers the server.

---

## 7. Levers: how the platform is made bespoke

Levers is not a fifth product. It is the configuration layer above all four: the organisation and its members, and three kinds of saved configuration that change how the products behave for that organisation. **Bundles** restrict which signals are served. **Presets** save a weighting for Scores. **Cohorts** define the organisation's own set of places and replace the national reference in Scores and Peers. Together they are how an enterprise customer gets a deployment that fits its own data model, and they come with a platform licence.

### 7.1 Organisations, members and roles

Every account has a personal organisation; a company creates its own with `POST /v1/orgs { "name": "Acme Property", "slug": "acme" }`. Members join by invitation (an emailed link, valid for seven days) with one of three roles:

| Role | Can read configuration | Can create and edit configuration | Can manage members and owners |
|---|---|---|---|
| `member` | yes | no | no |
| `admin` | yes | yes | add and remove members |
| `owner` | yes | yes | yes, including other owners; the last owner cannot be removed |

An organisation can be **white-labelled** with a `display_name`, `brand_url` and `logo_url`, which the console and `GET /v1/me` return so a partner's own users see the partner's brand. API keys can carry a **per-key IP allowlist** (CIDR ranges); a call from outside the list is refused with `ip_not_allowed`.

### 7.2 Bundles: which signals this organisation sees

A bundle is a named whitelist of public signal keys (1 to 100) saved on the organisation. A caller opts in by passing `?bundle=<id or slug>` on a request; with no bundle, every request sees the full catalogue.

Why a customer uses one: a partner licensed for crime and deprivation only; a product that wants a compact response with exactly the twelve signals it displays; a regulated workflow that must prove no unlicensed source influenced a result.

```
POST /v1/orgs/org_1791234567890_ab12cd/bundles
{ "name": "Crime only", "slug": "crime-only", "signal_keys": ["crime.total_12m", "crime.monthly_rate"] }
```

```json
{
  "id": "bndl_3f9a1c7e0b2d4a6c8e1f0a2b",
  "org_id": "org_1791234567890_ab12cd",
  "slug": "crime-only",
  "name": "Crime only",
  "signal_keys": ["crime.total_12m", "crime.monthly_rate"],
  "created_at": "2026-10-12T16:10:00.000Z",
  "updated_at": "2026-10-12T16:10:00.000Z"
}
```

Each endpoint applies the bundle in the way that keeps the result honest:

| Endpoint | Behaviour with `?bundle=` |
|---|---|
| `GET /v1/area` | **Filter.** The profile contains only the bundle's signals. With the bundle above, SE15 5DP returns two signals: `crime.total_12m` 1,619 and `crime.monthly_rate` 135, and `meta.sources` lists police.uk alone |
| `GET /v1/areas` | **Gate.** The ranking signal must be in the bundle. Asking to rank by `property.median_price` under the bundle above returns `422 { "error": "Signal \"property.median_price\" is not in bundle bndl_3f9a1c7e0b2d4a6c8e1f0a2b.", "code": "bundle_signal_not_allowed" }` |
| `POST /v1/query` | **Gate.** A plan (posted or generated from a question) that references a signal outside the bundle is refused with `bundle_signal_not_allowed` |
| `POST /v1/score` | **Neutralise.** A dimension whose sources are outside the bundle is scored at the neutral midpoint with confidence 0.2 and says so; the response carries an `X-Bundle-Applied` header |

Bundles are listed, read, updated and deleted under `/v1/orgs/{id}/bundles`. Keys are validated against the catalogue when saved.

### 7.3 Presets: this organisation's weights

A preset is a saved `{ base_preset, weights }` on the organisation, referenced on `POST /v1/score` by `preset_id`. The base preset selects the property rule (affordability, cost, or growth and yield); the weights override the defaults. The scoring engine is untouched; a preset only changes what it is asked.

Every organisation is seeded with four presets mirroring the defaults, named for the workflow they serve:

| Slug | Name | Base | Crime | Deprivation | Property | Schools | Amenities | Transport | Environment |
|---|---|---|---|---|---|---|---|---|---|
| `moving` | Residential origination | moving | 20 | 10 | 20 | 20 | 10 | 15 | 5 |
| `business` | Commercial site selection | business | 5 | 15 | 15 | 5 | 25 | 20 | 15 |
| `investing` | Investment underwrite | investing | 10 | 10 | 30 | 5 | 15 | 15 | 15 |
| `research` | Research baseline | research | 15 | 15 | 14 | 14 | 14 | 14 | 14 |

A customer edits these or adds its own:

```
POST /v1/orgs/org_1791234567890_ab12cd/presets
{ "name": "Buy-to-let underwrite", "slug": "btl", "base_preset": "investing",
  "weights": { "crime": 15, "deprivation": 10, "property": 35, "schools": 5, "amenities": 10, "transport": 20, "environment": 5 } }
```

```json
{
  "id": "spr_org_1791234567890_ab12cd_btl",
  "org_id": "org_1791234567890_ab12cd",
  "slug": "btl", "name": "Buy-to-let underwrite", "base_preset": "investing",
  "weights": { "crime": 15, "deprivation": 10, "property": 35, "schools": 5, "amenities": 10, "transport": 20, "environment": 5 },
  "created_at": "2026-10-12T16:12:00.000Z", "updated_at": "2026-10-12T16:12:00.000Z"
}
```

Then `POST /v1/score { "area": "SE15 5DP", "preset_id": "spr_org_1791234567890_ab12cd_btl" }` returns a score with `weights_source: "custom"` and the preset's weights on each dimension. `preset_id` is mutually exclusive with `preset` and `weights`; sending both returns `preset_id_conflict`.

### 7.4 Cohorts: this organisation's own reference set

A cohort is a named set of places saved on the organisation: up to 10,000 members, supplied as postcodes, neighbourhood codes or place ids in any mix (a group code such as an MSOA expands to its neighbourhoods). Anything that does not resolve is reported row by row (`cohort_members_unresolved`) rather than silently dropped.

A cohort does two things:

1. **In Scores**, `cohort: "<slug>"` replaces the national band as the reference set. Transport, schools, amenities and flood exposure are then ranked against the cohort's own members, so "this security ranks at the 80th percentile" means the 80th percentile **of the customer's book**, not of Great Britain's rural neighbourhoods. The response's `reference` becomes `{ "kind": "cohort", "slug": "northern-book", "name": "Northern lending book", "areas": 412 }`. A cohort needs at least 30 members with stored signals; a smaller one is refused with `cohort_too_small`. If a particular input is carried by fewer than 30 members, that dimension falls back to the band and the reasoning says so.
2. **In Peers**, `cohort` (or `cohort_id`) restricts the candidate peers to the cohort's members, so "places like this one" means "places like this one **within my portfolio**". The target itself need not be in the cohort.

```
POST /v1/orgs/org_1791234567890_ab12cd/cohorts
{ "name": "Northern lending book", "slug": "northern-book",
  "geo_codes": ["E01033010", "E01033011", "E01012345", "LS1 4AP", "oga_pl_7E7YT1RGSWR26", "E02002345", "..."] }
```

```json
{
  "id": "coh_1791234567890_n0rth1",
  "org_id": "org_1791234567890_ab12cd",
  "slug": "northern-book", "name": "Northern lending book",
  "geo_codes": ["E01033010", "E01033011", "..."],
  "created_at": "2026-10-12T16:15:00.000Z", "updated_at": "2026-10-12T16:15:00.000Z"
}
```

```
POST /v1/score
{ "area": "YO1 7HH", "preset": "investing", "cohort": "northern-book" }

POST /v1/peers
{ "target": { "postcode": "YO1 7HH" }, "k": 10, "cohort": "northern-book" }
```

The same cohort, defined once, now drives both products. This is the composability the shared foundation exists for.

### 7.5 Keys and the sandbox

API keys start with `oga_` and are shown once at creation. Each key can be named, revoked, given an IP allowlist, and can opt out of training-data capture (by default, plain-English questions and explained score requests may be used to improve the planner; the toggle is per key and takes effect on the next request). A signed-in user can also mint a **playground key** that expires at the end of the day, for trying the API reference without creating a permanent credential.

Every account starts on the **sandbox**: 200 calls a month, every product, the MCP server included, no card. The sandbox is for evaluation; production use needs a licence (section 9).

---
## 8. For developers and AI agents

### 8.1 The REST API

- **Base URL** `https://api.onegoodarea.com`. Every product endpoint is under `/v1`.
- **Authentication**: `Authorization: Bearer oga_<your key>`. The one exception is `POST /v1/query`, which accepts anonymous calls at a low rate so the query plane can be tried before signing up.
- **Every response** carries `X-Engine-Version` (the methodology version, `1.12.5` on 12 October 2026) and the rate-limit headers `X-RateLimit-Limit` and `X-RateLimit-Remaining`. Data responses also carry `meta.engine_version` and `meta.generated_at` in the body.
- **Errors** are JSON: `{ "error": "<sentence>", "code": "<machine code>" }`. Codes a client should handle include `invalid_signal`, `unsupported_question`, `ambiguous_location` (with `candidates[]`), `bundle_signal_not_allowed`, `cohort_too_small`, `cohort_members_unresolved`, `preset_id_conflict`, `no_org_context`, `levers_plan_required`, `ip_not_allowed`, `nl_quota_exceeded` and `monthly_quota_exceeded`.
- **Metering**: every call is one unit; bulk calls (place mapping, jobs) count one unit per resolved row and are checked against the remaining monthly quota before they start. `GET /v1/me` returns the plan, the calls used and remaining this month, whether API and MCP access are on, and the organisation the key belongs to.
- **Machine-readable documentation**: an OpenAPI 3 document at `https://www.onegoodarea.com/openapi.json`, `llms.txt` and `llms-full.txt` for language models, an interactive API reference on the website, and `GET /v1/meta` for the engine version and the full methodology history.

### 8.2 The MCP server

The Model Context Protocol (MCP) is the standard by which AI assistants and coding tools call external tools. OneGoodArea publishes an MCP server, `@oga-mcp/server`, that puts the whole engine inside Claude Desktop, Claude Code, Cursor, Windsurf and any other MCP client. It is listed in the official MCP Registry as `com.onegoodarea/oga-mcp`, and its source is public under the MIT licence.

Every answer is composed on the server from engine responses. The server adds no prose of its own and invents nothing: a tool result is a formatted rendering of what the API returned, with every number traceable to it.

**Installing it.** The server is not installed; the client spawns it with `npx` and an API key in the environment.

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "onegoodarea": {
      "command": "npx",
      "args": ["-y", "@oga-mcp/server"],
      "env": { "OOGA_API_KEY": "oga_<your key>" }
    }
  }
}
```

Claude Code:

```sh
claude mcp add onegoodarea -e OOGA_API_KEY=oga_<your key> -- npx -y @oga-mcp/server
```

Cursor uses the same JSON block in `.cursor/mcp.json`.

**The eleven tools.**

| Surface | Tool | Inputs | What comes back |
|---|---|---|---|
| Scores | `score_postcode` | `area`, `preset` | The 0 to 100 score, seven dimensions with reasoning and confidence, a summary, recommendations and data sources |
| Scores | `compare_postcodes` | `areas` (2 to 8), `preset` | A sorted comparison table with a per-area summary; a failure on one area is shown inline, not hidden |
| Signals | `get_area_signals` | `area`, `sort` | The full profile: every signal with value, unit, percentile, confidence and reason, source and period |
| Signals | `get_signals_by_category` | `area`, `category`, `sort` | One category of the profile |
| Intelligence | `find_areas` | `question` | The plain-English question translated into a plan, the plan itself, and the results |
| Intelligence | `find_peers` | `area`, `k` | The target, the signals compared on, and the ranked peers with distance |
| Monitor | `watch_portfolio` | `name`, `areas` (1 to 100) | A new portfolio with its id and the places added |
| Monitor | `get_portfolio_changes` | `portfolio_id`, `threshold_pct`, `baseline`, `min_transactions`, `cause` | The material changes between two periods, per place, with direction, before and after, delta and cause |
| Brief | `area_brief` | `area`, `audience` (`lender`, `insurer`, `retailer`, `investor`) | One audience-shaped brief: the verdict, the dimensions that audience weighs, the signals behind them with provenance, recommendations and sources. Each audience maps to a preset: lender to moving, insurer and investor to investing, retailer to business |
| Reference | `methodology_for` | `dimension` | The written methodology for one scoring dimension |
| Reference | `engine_version` | none | The current engine version, its release date and the most recent releases |

**An interaction, in words.** A user in Claude Desktop asks "Is SE15 5DP a sensible place for a first-time buyer, and what should I worry about?". The assistant calls `score_postcode("SE15 5DP", "moving")` and `get_signals_by_category("SE15 5DP", "crime")`, receives the 53/100 score with its seven reasoned dimensions and the 32 crime signals, and answers from them: schools and transport excellent for inner London, crime at the 99th percentile per resident with anti-social behaviour and shoplifting the largest shares, prices at £500,000 inherited from a group of 43 sales, twenty flood risk areas within 3 km but no active warnings. Every figure in the answer is a figure the API served, and the assistant can name the source and date of each.

**Data policy.** By default, plain-English questions sent through `find_areas` and explained `score_postcode` requests may be used to improve the planner. The server prints the capture state on every start, and it is switched off per key in the console.

---

## 9. Access and pricing

OneGoodArea is bought like infrastructure: evaluate free, prove it on one workflow, then license the layer. There is no self-serve checkout.

| Step | What it is |
|---|---|
| **Sandbox** | 200 calls a month, free, no card. Every product and the MCP server. For evaluation |
| **Pilot** | 40 days on one existing workflow, hands-on with the OneGoodArea team: keys and integration first, then shipping what the workflow needs week by week, then measuring against one success metric agreed up front. Licence terms are drafted by day 30, so the pilot ends in a decision. Nothing is charged while it runs |
| **Platform licence** | For showing OneGoodArea inside a product, in the partner's own design, with attribution. Annual, priced by reach (the records enriched or the end customers served), not by API call |
| **Data partnership** | For redistributing the data itself, in feeds or exports a partner's customers keep. A licence fee or revenue share |
| **Assured** | An add-on to a platform licence for regulated buyers: a provenance pack for the model file, a signed data processing agreement and dedicated support, on a custom annual contract |

Two platform licence scopes:

| | Build, from £2,000 a month | Decision, from £5,000 a month |
|---|---|---|
| Signals, with source, period and confidence on every value | yes | yes |
| Scores, with the four presets or custom weights | yes | yes |
| The MCP server, eleven tools | yes | yes |
| Bulk mapping, 1,000 per call and 20,000 per job | yes | yes |
| Production use with attribution | yes | yes |
| Intelligence: ranked search, peers, outliers, forecasts, plain-English questions | | yes |
| Monitor: portfolios, the change feed, signed webhooks | | yes |
| Batch scoring, saved presets, cohorts | | yes |
| IP allowlisting | | yes |

Calls are booked through the website.

---

## 10. What OneGoodArea does not do

Said plainly, because a clear scope is part of being trustworthy.

- **It does not describe a property.** The unit is the place: the neighbourhood, group or district. There are no address-level values, no valuations, no energy ratings, no floor areas. A customer who holds addresses resolves them to places and reads the place.
- **It does not let AI set a number.** The planner translates a question into a query; the store answers; the score is arithmetic over the store. Narrative, where offered, is written after the numbers and cannot change them.
- **It does not freeze methodology.** Every change is versioned, published and stamped on every response, and Monitor labels changes caused by a release. Old versions are not kept running.
- **It does not invent values for a gap.** Scotland has no street-level crime; Wales and Scotland have no comparable school grades; Greater Manchester and Gloucestershire have publisher gaps; Scotland has no property prices loaded. In every case the value is null, the reason is a sentence, and where a coarser official figure exists it is served as context at low confidence.
- **It does not cover Northern Ireland.**
- **It does not compare deprivation across nations**, because the three indices are built differently. Percentiles are always within the nation.
- **It does not sell data lookups by the row.** The offer is a licence to embed, or a partnership to redistribute, priced by reach.

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **Neighbourhood** | The smallest unit of place: an LSOA (Lower layer Super Output Area) in England and Wales, a Data Zone in Scotland. Typically 1,000 to 3,000 residents. 43,064 in the registry |
| **Group** | The next grain up: an MSOA (Middle layer Super Output Area) in England and Wales, an Intermediate Zone in Scotland. The grain ONS publishes house prices at |
| **District** | A local authority district or Scottish council area. 350 in Great Britain |
| **Place id** | The permanent OneGoodArea identifier of a place, `oga_pl_` plus thirteen characters, unchanged through boundary redraws |
| **Alias** | An official code a place is or was known by (LSOA 2011, LSOA 2021, MSOA, Data Zone 2011 or 2022, local authority, region, nation), with validity dates |
| **Succession** | The record of a place retired at a census and the places that replaced it, with shares |
| **Signal** | One value about one place, with key, category, label, value, unit, direction, confidence, reason, source, period and percentiles |
| **Signal key** | The stable identifier of a signal, such as `crime.rate_per_1000`. The part before the dot is the category |
| **Category** | One of seven: crime, deprivation, property, schools, amenities, transport, environment |
| **Confidence** | A number from 0 to 1 attached to every value, set by explicit ladders over sample size, coverage and age, always with a written reason |
| **Period** | The calendar dates a value describes, as `start` and `end` |
| **Period basis** | `reference` when the publisher states the period; `load` when the honest date is the day the value entered the store |
| **Released at** | The date the publisher released the edition |
| **Loaded at** | The date OneGoodArea loaded it |
| **Percentile** | Where a value sits among all neighbourhoods in its nation, 0 to 100, by the mid-rank rule. `regional_percentile` is the same within the region |
| **Normalised value** | The value scaled 0 to 1 within the nation; what peers and scoring consume |
| **Direction** | Whether a higher value is better, lower is better, or neither |
| **Native, inherited, aggregated** | How a value reaches the neighbourhood: published at that grain; carried down from a coarser grain with the reason saying so; or counted within a radius of the neighbourhood's centre |
| **Derived signal** | A signal computed from stored history: year-on-year change, trend slope, peer-relative z-score |
| **Peer-relative z-score** | How many standard deviations a neighbourhood's value sits from the mean of its twenty most similar neighbourhoods |
| **Methodology version, engine version** | The version of the method that produced a response, stamped on every response. 26 releases since 8 July 2026; 1.12.5 on 12 October 2026 |
| **Release** | A published change of method, with a version, a date, a summary and the signals and dimensions it affects |
| **Fetch mode** | How a response was answered: `store` (from the store alone) or `hybrid` (the store plus one live overlay, such as active flood warnings) |
| **Score** | A 0 to 100 composite for a purpose, built from seven dimensions |
| **Dimension** | One of the seven components of a Score, each with its own score, weight, confidence and reasoning |
| **Preset** | A named purpose that sets the weights: moving, business, investing, research. Also an organisation's saved weighting (section 7.3) |
| **Weights** | How much each dimension counts in the composite |
| **Band** | The kind of neighbourhood a place is ranked among for scoring: urban, suburban or rural, from the official rural-urban classification |
| **Reference set** | What a Score ranked the place against: the band, a cohort, or all of Great Britain |
| **Neutral midpoint** | 50, the score a dimension receives when its source is absent, at confidence 0.2, with the reason stated |
| **Portfolio** | A customer's named list of places, held by permanent id |
| **Baseline** | The earlier point a change check compares against: `previous` (the period before) or `first` (the first on record) |
| **Material change** | A move of at least the threshold percentage (default 5), for property also gated on a minimum number of sales (default 8) |
| **Cause** | Why a value moved: `source` (the world or its publisher), `method` (a methodology release), or `source_and_method` |
| **Feed** | The cursor-paged record of every stored value a refresh changed for a portfolio's places, with before and after |
| **Band crossed** | A feed flag: the value moved into a different national decile |
| **Webhook** | A signed HTTP delivery of a change to a customer's endpoint; `signal.changed` and `portfolio.feed` |
| **Plan** | A typed JSON query in the Intelligence grammar: an `op` and its `params` |
| **Op** | One of seven operations: `rank_areas`, `get_area`, `score_area`, `compare_areas`, `find_peers`, `find_insights`, `find_forecast` |
| **Planner** | The component that turns a plain-English question into a plan. It never sets a number |
| **Plan source** | `client` when the caller posted the plan, `nl` when the planner generated it |
| **Plannable** | A signal the query plane can rank and filter on (33 of the 78 public keys) |
| **Peers** | The neighbourhoods most similar to a target by distance over normalised signals |
| **Insights** | Neighbourhoods ranked by how far a signal sits from their peers, in standard deviations |
| **Forecast** | A straight-line projection of one signal's monthly history with a band of two residual standard errors |
| **Bundle** | An organisation's saved whitelist of signal keys, applied per request to filter profiles, gate rankings and queries, and neutralise score dimensions |
| **Cohort** | An organisation's saved set of up to 10,000 places, used as the reference set in Scores (minimum 30) and the candidate set in Peers |
| **Levers** | The configuration layer: organisations, members, roles, bundles, presets, cohorts, white-labelling, IP allowlists |
| **Sandbox** | The free tier: 200 calls a month for evaluation |
| **Platform licence** | The right to show OneGoodArea inside a product with attribution; Build and Decision scopes |
| **Data partnership** | The right to redistribute the data in feeds and exports |
| **MCP** | The Model Context Protocol, by which AI assistants call external tools. OneGoodArea's server is `@oga-mcp/server` |
| **OGL** | The Open Government Licence, under which the public publishers behind the signals release their data |

---

## 12. Endpoint index

| Product | Method and path | Purpose |
|---|---|---|
| Signals | `GET /v1/area` | Full profile by postcode, code, place id or name; `grain`, `sort`, `bundle` |
| Signals | `GET /v1/signals/{category}` | One category of the profile |
| Signals | `GET /v1/signals/metadata` | The catalogue |
| Signals | `GET /v1/area/schools` | Every school within 1.5 km, by name |
| Signals | `GET /v1/area/transactions` | Every sale in the neighbourhood, last twelve months |
| Signals | `GET /v1/areas` | Ranked list by one signal |
| Places | `GET /v1/places/resolve` | Resolve one input |
| Places | `POST /v1/places/resolve` | Resolve up to 1,000 inputs |
| Places | `GET /v1/places/{id}` | Read a place, its aliases, parents and successions |
| Places | `POST /v1/places/map` | Map up to 1,000 inputs to places with their signals |
| Jobs | `POST /v1/jobs/portfolio-map` | Map up to 20,000 inputs as a job |
| Jobs | `GET /v1/jobs`, `GET /v1/jobs/{id}`, `GET /v1/jobs/{id}/rows` | List, read, page results |
| Scores | `POST /v1/score` | Score a place: `preset`, `weights` or `preset_id`; `explain`; `cohort`; `bundle` |
| Monitor | `POST /v1/portfolios`, `GET /v1/portfolios`, `GET /v1/portfolios/{id}`, `PATCH /v1/portfolios/{id}`, `DELETE /v1/portfolios/{id}` | Portfolios |
| Monitor | `POST /v1/portfolios/{id}/areas`, `DELETE /v1/portfolios/{id}/areas/{area}` | Places in a portfolio |
| Monitor | `POST /v1/portfolios/{id}/enrich` | Score every place |
| Monitor | `GET /v1/portfolios/{id}/changes`, `POST /v1/portfolios/{id}/changes` | Probe (read-only) or detect and emit changes |
| Monitor | `GET /v1/portfolios/{id}/feed` | The change feed |
| Monitor | `POST /v1/webhooks`, `GET /v1/webhooks`, `DELETE /v1/webhooks/{id}`, `POST /v1/webhooks/{id}/rotate-secret` | Webhook subscriptions |
| Intelligence | `POST /v1/query` | A plan or a plain-English question |
| Intelligence | `POST /v1/peers` | Similar places |
| Intelligence | `POST /v1/insights` | Outliers against peers |
| Intelligence | `POST /v1/forecast` | Project one signal |
| Levers | `POST /v1/orgs`, `GET /v1/orgs`, `GET /v1/orgs/{id}`, `PATCH /v1/orgs/{id}`, `DELETE /v1/orgs/{id}` | Organisations and white-labelling |
| Levers | `/v1/orgs/{id}/members`, `/v1/orgs/{id}/invitations`, `POST /v1/invitations/{token}/accept` | Members, roles, invitations |
| Levers | `/v1/orgs/{id}/bundles` | Bundles (create, list, read, update, delete) |
| Levers | `/v1/orgs/{id}/presets` | Saved scoring presets |
| Levers | `/v1/orgs/{id}/cohorts` | Cohorts |
| Account | `GET /v1/me` | Plan, usage, access, organisation |
| Reference | `GET /v1/meta` | Engine version and methodology history |
| Reference | `GET https://www.onegoodarea.com/openapi.json` | The OpenAPI document |
