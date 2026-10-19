# OneGoodArea traction, 11 October 2026

*Every figure below was read on 11 October 2026 from the production database (read-only), PostHog (internal and test traffic excluded), the npm registry, GitHub, Jira and the business documents in this folder. Internal identities (founders, family testers, the probe, the showcase and the area pages) are excluded from every account and usage figure. Refresh with the sources in section 8.*

---

## 1. In one paragraph

OneGoodArea is pre-revenue and at the pilot stage. The product is built and live: four products on one engine, 52,025 places with permanent ids, about 6.8 million observations, 26 methodology releases since launch on 8 July, a daily production probe. The first pilot is live with a location data company that resells to 300+ organisations, a second property intelligence company has agreed to revisit later in the year after its data-quality points were closed, a third data business is in partnership conversation, and a senior underwriter is in conversation to join an advisory board. Thirty-five external accounts have signed up since March, ten of them hold API keys and five have called the API. The MCP server has been downloaded 1,383 times from npm in the last 30 days and has been in the official MCP Registry since 10 October. The website had 282 visitors in the last 30 days. The go-to-market reset to property and location product builders on 6 October and its first 30 days are under way.

---

## 2. Commercial

| Account | Type | Where it stands | Dates |
|---|---|---|---|
| Huq Industries | Location data (footfall, movement, spend); "300+ organisations" in 22 countries | **Pilot live.** API access granted; their lead signed in on 1 October. Joint analysis of five UK retail centres delivered; they called it "very good reading" and widened the conversation to three more people. A joint test is prepared: 20 to 50 of their sites with footprints and 12 months of footfall. They have asked for finer granularity and polygons | First call 2 Sep; analysis 4 Sep; reply 11 Sep; second call prepared 24 Sep; pilot access October |
| Infabode | Property intelligence hub with an AI hub (MCP and API) | **Revisit later in the year.** Sample pack for two postcodes delivered; four data-quality points raised and all four shipped (crime per 1,000 residents, thin-sample trend suppression, schools confidence by sample, crime freshness) between 15 and 24 September | Call 27 Aug; reply 5 Sep |
| A third data business | Data company | In partnership conversation about licensing the layer inside its product | September |
| Insurance advisor | About thirty years as a head of underwriting | Prospective advisory board member; call held, framing adopted ("reliable, current and traceable location evidence") | 29 Sep |

**Pricing and revenue.** The ladder is a free sandbox (200 calls a month), a 40-day pilot, then a platform licence from £2,000 a month (Build) or £5,000 a month (Decision), or a data partnership. No licence has been signed yet. Stripe holds two external accounts on the free plan and no paid subscription.

**Pipeline built, 6 October.** 104 companies scored across nine builder categories: 61 Tier A, 36 Tier B, 7 Tier C. A priority list of fifteen and a first 25 for outreach, with the entry product and the first title to approach for each. Outreach runs by builder type with the "send us your locations" offer (up to 1,000 of their postcodes enriched within two working days).

**Events on the calendar.** UKPA sessions in London on 8, 13 and 21 October; the UK PropTech Awards on 26 November; the London PropTech Show in March 2027.

---

## 3. Accounts and usage

| Measure | Value |
|---|---|
| External sign-ups since March | 35 (27 with email and password, 8 through Google or GitHub) |
| Sign-ups by month | Mar 10, Apr 3, May 3, Jun 9, Jul 6, Aug 0, Sep 3, Oct 1 |
| External accounts holding an API key | 10 (19 keys in all) |
| Keys used in the last 90 days / last 30 days | 9 / 3 |
| External accounts that have called the API | 5 |
| External API calls by month | Jul 80 (3 accounts), Sep 17 (2 accounts) |
| What external accounts called, last 90 days | area profile 24, query plane 17, score 14, ranked areas 7, place resolve 6, signals by category 5, peers 4, forecast 3, schools 3, portfolio and bulk map 5 |
| Plain-English questions from external accounts | 14 (July) |
| External portfolios / webhook subscriptions | 1 / 1 |
| Bulk mapping jobs run | 2, both succeeded |
| API calls from internal identities, for scale | Sep 5,197, Oct to date 4,328 (the daily probe, the area pages, the showcase, our own testing) |

The product usage that exists is evaluation: a handful of accounts reading profiles, scores and the query plane. Sustained usage waits on the pilots.

---

## 4. The MCP server

| Measure | Value |
|---|---|
| npm downloads, `@oga-mcp/server` | Jul 158, Aug 54, Sep 505, Oct 1 to 10: 885 |
| Last 30 days / last 7 days | 1,383 / 689 |
| Version | 1.0.11, published 10 October |
| Official MCP Registry | Listed as `com.onegoodarea/oga-mcp` since 10 October, DNS-verified namespace |
| Public source mirror | `github.com/OneGoodArea/oga-mcp`, created 10 October |
| Directory submissions | awesome-mcp-servers pull request open; mcp.so submission filed; Glama ownership declared, listing pending |
| MCP calls recorded by the API | Jun 17, Aug 78, Sep 119, all from one internal account |

Downloads are not yet usage: every MCP call the API has recorded so far came from our own account. From 1.0.11 the server names its host client (Claude Desktop, Claude Code, Cursor), so the PostHog MCP adoption dashboard will show real clients as they pick it up.

---

## 5. The website

PostHog, internal traffic excluded, from 25 August when analytics began.

| Measure | Last 30 days | Since 25 August |
|---|---|---|
| Unique visitors | 282 | 511 |
| Pageviews | 645 | 1,077 |
| Sessions | 357 | 621 |
| Average session | 2 min 56 s | 2 min 37 s |
| Bounce rate | 63.6% | 67.0% |

**Weekly unique visitors**, weeks starting 23 August to 4 October: 71, 68, 120, 63, 88, 51, 86.

**Channels, last 30 days:** direct 72%, referral 17% (mostly our own domain), organic search 7.5% (22 visitors: Google 16, Bing 3), AI assistants 2.4% (7 visitors), organic social 1% (LinkedIn 3).

**Countries, last 30 days:** United Kingdom 58%, United States 21%, Singapore 5%, Ireland 5%, China 4%, Poland 2%, Netherlands 2%.

**Most visited pages, last 30 days (visitors):** home 163, changelog 43, sign-in 19, pricing 18, Signals product 15, API usage 14, playground 14, MCP docs 11, For PropTech 10, showcase 10, dashboard 9, docs 9, Scores product 8, methodology 7, Intelligence product 7.

**Longer run, our own server-side pageview log (includes crawlers, so not comparable with PostHog):** Mar 304, Apr 1,007, May 1,301, Jun 2,046, Jul 1,179, Aug 1,118, Sep 1,373, Oct to the 11th 280.

**Search and machine readability.** Google Search Console and Bing Webmaster verified; 64 public pages in the sitemap, every one with metadata within search limits; IndexNow submits every page after each production deploy (first run accepted all 64). `llms.txt`, `llms-full.txt`, a crawlable OpenAPI document, JSON-LD Dataset and FAQ markup, robots rules that welcome AI crawlers.

---

## 6. Build and data velocity

The clearest traction so far is execution.

| Measure | Value |
|---|---|
| Public launch | 8 July 2026 (methodology 1.0.0) |
| Methodology releases since launch | 26, to 1.12.5 on 6 October |
| Jira tickets closed | 969 |
| Pull requests | 881 |
| Commits since March | 1,818 |
| Architecture Decision Records | 67 |
| Automated tests | 2,787 API, 341 web, 141 contracts, 183 MCP |
| Places with permanent ids | 52,025 (43,064 neighbourhoods across England, Wales and Scotland) |
| Observations in the store | about 6.8 million (2,648,582 current values, 4,114,523 history rows) |
| Signals in the catalogue | 83 (78 public), 65 served per neighbourhood |
| Crime history | monthly counts from April 2023 to August 2026 |
| Sales stored | 1,356,034 since January 2025 |
| Schools | 21,957, with 269,929 school-to-neighbourhood rows |
| Production probe | 45 postcodes, 3,790 checks, daily, green |

---

## 7. What we measure from here

The GTM pack sets three measures. Current values on 11 October:

| Measure | Definition | Now |
|---|---|---|
| Density | Qualified accounts contacted, then replies, calls, samples, pilots, licences, read per builder type | 104 scored, 25 selected for outreach; pilots 1; licences 0 |
| Reach | End customers reachable through signed partners | 0 signed; 300+ organisations through Huq once the pilot converts |
| Speed | Days from first reply to first API call | Huq: first call 2 September, first sign-in 1 October |

The next milestones that move this document: the Huq joint test delivered and a licence shape agreed; the first sample enrichment packs returned and the reply rate per builder type; the first external client on the MCP adoption dashboard; the first signed partner.

---

## 8. Sources and how to refresh

- **Accounts, keys, calls, questions, portfolios, plans:** `docs/_local/traction-counts.mjs` in the repository (read-only queries against production, run from `apps/api` with `node --input-type=module -e "$(cat ../../docs/_local/traction-counts.mjs)"`). Internal identities are excluded inside the script.
- **Website:** PostHog project 257448 (EU), dashboards "OneGoodArea Overview" (915104) and "Customers" (1001871); the web analytics scene with internal traffic filtered.
- **MCP:** PostHog dashboard "MCP adoption" (1011188); npm download counts at `https://api.npmjs.org/downloads/point/last-month/@oga-mcp/server` and `/downloads/range/<from>:<to>/@oga-mcp/server`; the registry at `https://registry.modelcontextprotocol.io/v0.1/servers?search=com.onegoodarea/oga-mcp`.
- **Pipeline:** `OneGoodArea-GTM-2026-10.md`, `OneGoodArea-GTM-Accounts-2026-10.md`, the Huq and Infabode call preparation files in this folder.
- **Build:** `git rev-list --count main`, the highest pull request number, Jira `project = AR AND status = Done`, `docs/DECISIONS`, the four test suites.
