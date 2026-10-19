# OneGoodArea, the same two postcodes re-run, 12 October 2026

The two postcodes from the 27 August sample, one inner London and one rural
Cumbria, run again through the OneGoodArea engine on 12 October 2026. Real
production output, engine version **1.12.5** (released 6 October 2026), not
illustrative. Every value carries its **source**, its **observation period**,
its **confidence** and the engine's reasoning in words.

Section 1 takes the four points raised on 5 September and shows each one
before and after. Sections 2 and 3 are the full output in the same shape as
August. Section 4 is what changed that was not asked for.

**How to read each signal:** value · national percentile (where ranked) ·
confidence with the engine's reasoning · source · period.

---

## 1. The four points, before and after

### Point 1. Crime was a raw count, not comparable across areas

Now every neighbourhood carries **recorded crimes per 1,000 usual residents**
beside the count, with its own national percentile. The denominator is the
Census 2021 population of the neighbourhood and is served as a signal of its
own, so the rate can be checked.

| | 27 August | 12 October |
|---|---|---|
| SE15 5DP | 1,563 crimes, count only | 1,619 crimes · **731.9 per 1,000 residents** (2,212 residents) · 99.4th percentile, lower is better |
| LA22 0EN | 118 crimes, count only | 127 crimes · **89.9 per 1,000 residents** (1,412 residents) · 63.7th percentile |

A note on SE15 5DP. It is a high-street neighbourhood with few residents, so
crime recorded against footfall reads very high per resident. That is exactly
why the count, the rate and the percentile are served together rather than one
of them alone.

### Point 2. A property trend of -55.5% off a single sale

The median price and its year-on-year change now come from the **ONS House
Price Statistics for Small Areas**, the official rolling-year median for the
neighbourhood group (MSOA) an area belongs to. The reasoning names the group
and the number of sales behind it. **No neighbourhood trend is served from
fewer than ten sales.** The Land Registry count of sales in the neighbourhood
is kept as its own signal with its own confidence.

| | 27 August | 12 October |
|---|---|---|
| SE15 5DP | £230,000 · -55.5% · 1 sale · confidence 40% | **£500,000 · +20.5% year on year** · from 43 sales in group E02000828, year ending March 2026 · confidence 90%. Sales in the neighbourhood itself: 7 (HM Land Registry, confidence 40%, "treat as indicative") |
| LA22 0EN | £683,750 · +36.1% · 4 sales · confidence 40% | **£415,870 · -14.1% year on year** · from 60 sales in group E02004015, year ending March 2026 · confidence 90%. Sales in the neighbourhood: 17 (confidence 60%, "a moderate sample") |

The August figures were artefacts of thin samples. Both areas now carry an
official series and say which sales support it.

### Point 3. Schools confidence identical for 1 school and for 11

Schools confidence now follows the sample: 90% with six or more graded
schools within 1.5 km, 60% with three to five, 40% with one or two. It drops
a further band when fewer than three in four schools in range carry a grade,
and again when the median grade is more than six years old. The reasoning
names the count and the inspection dates. The full Ofsted register is loaded
(19,897 graded schools of 21,957), which is why the counts rose.

| | 27 August | 12 October |
|---|---|---|
| SE15 5DP | 11 inspected · 100% Good or Outstanding · confidence 90% | **25 of 28 schools within 1.5 km graded** (inspections Jan 2020 to Jan 2026) · 96% Good or Outstanding (3 Outstanding, 21 Good, 1 Requires Improvement, 0 Inadequate) · median grade age 2.9 years · confidence 90%, "a robust sample" |
| LA22 0EN | 1 inspected · 0% · confidence 90% | **1 graded school within 1.5 km** (inspected Feb 2024), Requires Improvement · 0% Good or Outstanding · **confidence 40%**, "too few for a reliable share; the share is served but not ranked" |

A 1 km variant is now served alongside: SE15 5DP has 12 of 14 schools graded
within 1 km, 100% Good or Outstanding; LA22 0EN has no school within 1 km and
says so at 0% confidence.

### Point 4. Crime served a month behind police.uk

A daily check now watches police.uk's release. Every crime figure covers the
twelve calendar months ending at **police.uk's latest published month**, and
a month with no recorded crime counts as zero rather than stretching the
window back.

| | 27 August | 12 October |
|---|---|---|
| Both postcodes | July 2025 to June 2026, served when July 2026 was already published | **September 2025 to August 2026**, the latest month police.uk has published, loaded on 1 October |

---

## 2. SE15 5DP, Southwark, London

Neighbourhood E01004067 · group E02000828 · Southwark · London · England ·
urban major conurbation · OneGoodArea place `oga_pl_YXC6XP2HFFQEA`

### crime
- **Recorded crimes (12 months):** 1,619 · 99.6th percentile (lower is better) · confidence 100% ("a robust sample") · police.uk · Sep 2025 to Aug 2026
- **Recorded crimes per 1,000 residents (12 months):** 731.9 · 99.4th percentile · confidence 100% · police.uk and ONS Census 2021 · Sep 2025 to Aug 2026
- **Usual residents (Census 2021):** 2,212 · confidence 90% · ONS Census 2021 · 21 Mar 2021
- **Recorded crimes per month:** 135 · confidence 100% · police.uk · Sep 2025 to Aug 2026
- **By type (count, share):** anti-social behaviour 414 (26%) · violence and sexual offences 299 (18%) · shoplifting 231 (14%) · other theft 136 (8%) · theft from the person 132 (8%) · robbery 70 (4%) · public order 66 (4%) · drugs 65 (4%) · burglary 54 (3%) · vehicle crime 54 (3%) · bicycle theft 42 (3%) · criminal damage and arson 33 (2%) · other crime 12 (1%) · possession of weapons 11 (1%) · police.uk official type names

### deprivation
- **Deprivation decile (1 most deprived, 10 least):** 2 · 15th percentile · confidence 90% · IMD 2025, released 30 Oct 2025
- **Deprivation rank (higher is less deprived):** 6,010 · 17.8th percentile · confidence 90% · IMD 2025
- **Domain deciles:** income 2 · employment 3 · health 6 · education 5 · crime 1 · barriers to housing and services 2 · living environment 2 · IMD 2025

### property
- **Median sale price:** £500,000 · 86.2nd percentile nationally, 45.1st within London · confidence 90% · ONS HPSSA, rolling-year median for group E02000828 from 43 sales · year ending Mar 2026, released 17 Sep 2026
- **Price change (year on year):** +20.5% · confidence 90% · ONS HPSSA, same series · year ending Mar 2026
- **Sales in the year, this neighbourhood:** 7 · confidence 40% ("only 7 sales in the period, a small sample; treat the figure as indicative") · HM Land Registry · Apr 2025 to Mar 2026

### schools
- **Graded schools within 1.5 km:** 25 of 28 · 98.3rd percentile · confidence 90% ("25 of 28 schools within 1.5km carry a grade, inspections Jan 2020 to Jan 2026, a robust sample") · Ofsted · register as at 31 Aug 2026
- **Rated Good or Outstanding:** 96% · 48.1st percentile · confidence 90% · Ofsted
- **Outstanding:** 3 · **Good:** 21 · **Requires Improvement:** 1 · **Inadequate:** 0 · **Median age of the grades:** 2.9 years · Ofsted
- **Within 1 km:** 12 of 14 schools graded · 100% Good or Outstanding · 67.8th percentile · confidence 90% · Ofsted

### amenities
- **Amenities nearby (total):** 429 · confidence 85% · OpenStreetMap, precomputed nearby counts · 3 to 5 Oct 2026
- **Restaurants and cafes:** 117 · **Pubs and bars:** 40 · **Healthcare:** 31 · **Shops:** 38 · **Parks and leisure:** 125 · OpenStreetMap

### transport
- **Transport stations nearby:** 9 · confidence 90% · NaPTAN, the national public transport access node register · 3 Oct 2026
- **Bus stops nearby:** 23 · confidence 90% · NaPTAN

### environment
- **Flood-risk areas within 3 km:** 20 · confidence 90% · Environment Agency flood areas and outlines · list retrieved 5 Oct 2026
- **Active flood warnings:** 0 · confidence 90% ("flood warnings in force when this response was made") · Environment Agency live check · 12 Oct 2026

**Sources:** police.uk · ONS Census 2021 · IMD 2025 · ONS HPSSA · HM Land Registry · Ofsted · OpenStreetMap · NaPTAN · Environment Agency

---

## 3. LA22 0EN, rural Cumbria (Lake District)

Neighbourhood E01019375 · group E02004015 · Westmorland and Furness · North
West · England · smaller rural, further from a major town · OneGoodArea place
`oga_pl_2VNTVHWDDM60V`

### crime
- **Recorded crimes (12 months):** 127 · 55.2nd percentile (lower is better) · confidence 100% ("a robust sample") · police.uk · Sep 2025 to Aug 2026
- **Recorded crimes per 1,000 residents (12 months):** 89.9 · 63.7th percentile · confidence 100% · police.uk and ONS Census 2021 · Sep 2025 to Aug 2026
- **Usual residents (Census 2021):** 1,412 · confidence 90% · ONS Census 2021 · 21 Mar 2021
- **Recorded crimes per month:** 11 · confidence 100% · police.uk · Sep 2025 to Aug 2026
- **By type (count, share):** violence and sexual offences 58 (46%) · other theft 19 (15%) · public order 11 (9%) · drugs 10 (8%) · burglary 9 (7%) · criminal damage and arson 8 (6%) · other crime 3 (2%) · vehicle crime 3 (2%) · possession of weapons 2 (2%) · anti-social behaviour 1 · robbery 1 · shoplifting 1 · theft from the person 1 · bicycle theft 0 · police.uk official type names

### deprivation
- **Deprivation decile (1 most deprived, 10 least):** 8 · 75th percentile · confidence 90% · IMD 2025, released 30 Oct 2025
- **Deprivation rank (higher is less deprived):** 23,645 · 70.1st percentile · confidence 90% · IMD 2025
- **Domain deciles:** income 10 · employment 10 · health 10 · education 8 · crime 7 · barriers to housing and services 2 · living environment 2 · IMD 2025

### property
- **Median sale price:** £415,870 · 75.4th percentile nationally, 96.1st within the North West · confidence 90% · ONS HPSSA, rolling-year median for group E02004015 from 60 sales · year ending Mar 2026, released 17 Sep 2026
- **Price change (year on year):** -14.1% · confidence 90% · ONS HPSSA, same series · year ending Mar 2026
- **Sales in the year, this neighbourhood:** 17 · confidence 60% ("17 sales in the period, a moderate sample; treat the figure as indicative") · HM Land Registry · Apr 2025 to Mar 2026

### schools
- **Graded schools within 1.5 km:** 1 · 5.7th percentile · confidence 40% ("1 graded school within 1.5km, inspected Feb 2024, too few for a reliable share of Good or Outstanding; the share is served but not ranked") · Ofsted · register as at 31 Aug 2026
- **Rated Good or Outstanding:** 0% · not ranked · confidence 40% · Ofsted
- **Outstanding:** 0 · **Good:** 0 · **Requires Improvement:** 1 · **Inadequate:** 0 · **Median age of the grades:** 2.6 years · Ofsted
- **Within 1 km:** no Ofsted school found · confidence 0% · Ofsted

### amenities
- **Amenities nearby (total):** 92 · confidence 85% · OpenStreetMap, precomputed nearby counts · 3 to 5 Oct 2026
- **Restaurants and cafes:** 47 · **Pubs and bars:** 14 · **Healthcare:** 4 · **Shops:** 3 · **Parks and leisure:** 11 · OpenStreetMap

### transport
- **Transport stations nearby:** 0 · confidence 90% · NaPTAN · 3 Oct 2026
- **Bus stops nearby:** 8 · confidence 90% · NaPTAN

### environment
- **Flood-risk areas within 3 km:** 4 · confidence 90% · Environment Agency flood areas and outlines · list retrieved 5 Oct 2026
- **Active flood warnings:** 0 · confidence 90% ("flood warnings in force when this response was made") · Environment Agency live check · 12 Oct 2026

**Sources:** police.uk · ONS Census 2021 · IMD 2025 · ONS HPSSA · HM Land Registry · Ofsted · OpenStreetMap · NaPTAN · Environment Agency

---

## 4. Also changed since August, not asked for

- **Transport from the official register.** Stations and bus stops come from NaPTAN, the national public transport access node register, instead of OpenStreetMap.
- **Flood areas from the Environment Agency's full list and outlines**, retrieved 5 October 2026. SE15 5DP now shows 20 flood-risk areas within 3 km where August showed 0, and LA22 0EN shows 4 where August showed no coverage. The August file under-counted and its method was not recorded, which the methodology notes say in those words.
- **Deprivation by domain.** The seven IMD 2025 domain deciles are served beside the overall decile and rank.
- **Crime by type.** All fourteen police.uk types with counts and shares, under their official names.
- **Typed periods and confidence reasons on every value.** Each value says the period it covers, the date the source released it, when it was loaded, and why its confidence is what it is, in words.

### What this shows

- **The same structure in very different places.** The same categories and the same shape for an inner London high street and a Lake District village.
- **Honest coverage.** Where the evidence is thin the value says so and is served without a rank (one graded school in LA22 0EN at 40% confidence). Where a live check could not be made the value is unknown, not zero.
- **Every value traces to an official source, a period and a release.** The reasoning names the publisher, the sample and the dates.
- **Versioned and disclosed.** Engine 1.12.5. Every release since 1.0.0 on 8 July 2026 is listed publicly with what changed and why. The same request returns the same numbers within a release, and a value that moves between releases says which release moved it. A daily probe of 45 postcodes checks production against expected values after every refresh.
