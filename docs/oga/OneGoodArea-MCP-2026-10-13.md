# The OneGoodArea MCP server: where it is, how it is going, how it scales, what it could become

*Written 13 October 2026. Every number comes from the production database (read-only), the npm downloads API, the official MCP Registry, GitHub, Jira, the repository at commit 371b4140 and the Render dashboard, all read on that day. Internal identities (founders, family testers, the probe, the showcase and the area pages) are excluded from every usage figure, as in the traction scoreboard of 11 October. Section 8 says how to refresh each figure.*

---

## How to read this document

Section 1 is the whole story on one page. Section 2 explains what the MCP server is for a reader who has not met the protocol. Section 3 is the inventory: what exists, where it is published, how a call travels, who may use it, how it is built and released, and its history. Section 4 is the honest state of adoption, with the numbers. Section 5 is scalability: what carries load today, what breaks first, and what scales for free. Section 6 is what it could become, in the order the roadmap already implies. Section 7 lists the decisions that are yours and Marcos's. Section 8 is the appendix of figures and sources.

---

## 1. The one-page version

OneGoodArea publishes an MCP server called `@oga-mcp/server`. It is a small program that an AI assistant (Claude Desktop, Claude Code, Cursor, Windsurf and any other client that speaks the Model Context Protocol) starts on the user's own machine. Once started, it gives the assistant eleven tools, each of which calls the OneGoodArea API with the user's own API key and returns a formatted rendering of what the API said. The server adds no prose and invents no number. It is one way to deliver the API, not a separate product.

**Where it is.** Version 1.0.12, published on npm and in the official MCP Registry as `com.onegoodarea/oga-mcp` on 12 October. Public source at github.com/OneGoodArea/oga-mcp (MIT), mirrored automatically from the private repository. A docs page at onegoodarea.com/docs/mcp, a `.well-known/mcp.json` manifest, and mentions in `llms.txt` and the changelog. Eleven tools across six surfaces, 183 automated tests, a release procedure you run by hand.

**How it is going.** Distribution signals are healthy and usage signals are zero. npm has counted 1,426 downloads in the last 30 days, but the daily series spikes on every publish day (160, 158, 262 and 188 downloads on the four October release days, against single digits in between), which is the signature of registry mirrors and scanners, not of people installing it. The API has recorded 215 calls that came through the MCP server since June, every one of them from our own account. No external account has ever called the API through MCP. Ten external accounts hold API keys; none has used the server. The GitHub mirror has no stars. The three directory submissions are still pending.

**What this week showed.** The plain-English tool, `find_areas`, depends on the API's language-model chain, which was down from about 8 October until 14:59 today for every tier. The paid tiers came back at 14:59 (a workspace-scoped Anthropic key on Render). The free tiers, which is what every sandbox key and therefore every external MCP user runs on, came back at 17:39 with AR-1118 (PR 890): the withdrawn free models replaced with ones that exist, one warn line per failed hop in the logs, and the MCP test suite added to CI. Only the DeepSeek key on Render remains open.

**How it scales.** The server itself does not need scaling: it is stateless, it runs on the user's computer, and every user pays for their own process. Everything that matters for scale is the API behind it: a free-plan Render instance in Frankfurt that sleeps after 15 minutes of inactivity and takes up to a minute to wake, per-minute quotas by tier, a 200-call monthly allowance on the sandbox plan, and a language-model chain that costs real money per question and fails silently when its providers change. Ten active users would be fine. A hundred would expose the cold starts. A thousand would need the hosted endpoint, a paid instance, and a budget line for the planner.

**What it could become.** The roadmap already names the next two steps: the directory listings, an MCPB bundle and a Smithery listing (N12, this quarter), then a hosted endpoint over Streamable HTTP with OAuth so an agent connects to a URL with no install (X6, next year). Beyond those, the tool surface should follow the products: the place resolver, history as of a date, bundles and presets from Levers, polygons and points when granularity lands, and a coverage and freshness tool. The measure that matters is not downloads. It is external accounts calling the API through MCP each week, and that number is zero today.

---

## 2. What the MCP server is, in plain language

**The protocol.** The Model Context Protocol is an open standard, started by Anthropic in late 2024, that lets an AI assistant call outside tools in a uniform way. A tool is a named function with a documented input shape. The assistant reads the list of tools, decides when to call one, sends the arguments, and receives a text result it can reason over. Claude Desktop, Claude Code, Cursor, Windsurf, VS Code and ChatGPT all speak it now. There is an official registry of servers, run by the protocol's maintainers, that clients can search.

**Our server.** `@oga-mcp/server` is a Node program of about two thousand lines. A client starts it with `npx -y @oga-mcp/server` and talks to it over standard input and output. On start it reads the user's OneGoodArea API key from an environment variable, calls `/v1/me` to check that the key's plan includes MCP, prints the plan name, the engine version and whether training capture is on for that key, and then waits for tool calls. Every tool call becomes one or more requests to api.onegoodarea.com with that key. The response is rendered as text: a score table, a signals catalogue, a comparison, a brief. Numbers, sources, periods and confidence come straight from the API; the server never computes or writes a number itself.

**Why it exists.** Three reasons, in the order they were decided. First, in June the company line was "built for AI" and an MCP server was the proof. Second, since the GTM reset of 6 October the line is "the intelligence layer for place" and the server is one of three delivery routes, next to the REST API and the feed: a partner's engineers can try the whole engine from inside Claude or Cursor in two minutes without writing a client. Third, it is a distribution channel with no sales motion: one registry listing is visible to every agent that searches it.

**The rule it embodies.** "The AI writes the query, never the number." The assistant chooses which tool to call and with which arguments. OneGoodArea computes the answer. Nothing in the chain lets the model make a figure up and present it as ours.

---

## 3. Where it is today

### 3.1 The places it lives

| Place | State on 13 October | Notes |
|---|---|---|
| npm, `@oga-mcp/server` | 1.0.12 is `latest`, published 12 October | Thirteen versions since 29 June; see 3.7 |
| Official MCP Registry | `com.onegoodarea/oga-mcp` 1.0.12, status active, isLatest true, published 12 October 18:26 UTC; 1.0.11 kept as the previous version | Namespace verified by a DNS TXT record on the apex of onegoodarea.com, not by GitHub |
| Public source | github.com/OneGoodArea/oga-mcp, MIT, last push 12 October | One-way mirror of `mcp/` in the private repository, pushed by a workflow on every merge that touches `mcp/`; never edited directly |
| Docs | onegoodarea.com/docs/mcp (HTTP 200) | Install blocks for Claude Desktop, Cursor and Claude Code; the registry name; tool groups |
| Manifest | onegoodarea.com/.well-known/mcp.json | Version, package, env vars, the eleven tool names, the OpenAPI link |
| Mentions | `llms.txt`, `llms-full.txt`, the changelog (October release), the README on npm | All read the registry name from one constant so they cannot drift |
| Directories | awesome-mcp-servers pull request 16145 open; mcp.so submission filed as issue 5092; Glama ownership declared in `glama.json`, listing not yet indexed; Smithery not possible without a hosted endpoint or an MCPB bundle | AR-1097 stays In Progress until one listing is live; AR-1101 holds the MCPB and Smithery work |

### 3.2 The eleven tools

| Tool | Surface | What it calls | What it returns |
|---|---|---|---|
| `score_postcode(area, preset)` | Scores | `GET /v1/score?explain=true` | 0 to 100 score, seven dimensions with reasoning and confidence, summary, recommendations, sources, engine version |
| `compare_postcodes(areas, preset)` | Scores | one score call per area, 2 to 8 areas | sorted comparison table with per-area summaries; partial failures shown inline |
| `get_area_signals(area, sort?)` | Signals | `GET /v1/area` | the full catalogue: value, unit, percentile, confidence and reason, source, period, release and load dates |
| `get_signals_by_category(area, category, sort?)` | Signals | `GET /v1/signals/:category` | the same shape for one of the seven categories |
| `find_areas(question)` | Intelligence | `POST /v1/query` with a question | the plan the planner wrote plus its results, so the answer carries the query that produced it |
| `find_peers(area, k?)` | Intelligence | `GET /v1/peers` | the nearest neighbours by normalised signal values, with distance and the dimensions used |
| `watch_portfolio(name, areas)` | Monitor | `POST /v1/portfolios` then add areas | the new portfolio id and the area list; partial state surfaced if the add step fails |
| `get_portfolio_changes(portfolio_id, ...)` | Monitor | `GET /v1/portfolios/:id/changes` | material moves between two periods, with cause (source, method, both); probe calls do not fire webhooks |
| `area_brief(area, audience)` | Brief | `GET /v1/area` and `GET /v1/score?explain=true` | one advisory document for lender, insurer, retailer or investor, composed from the signals and the matching preset |
| `methodology_for(dimension)` | Reference | nothing (static text in the package) | source, scoring rule and per-preset weight for a dimension; no quota cost |
| `engine_version()` | Reference | the live API | the engine version and the latest methodology releases |

Presets are `moving`, `business`, `investing` and `research`. The seven categories are crime, deprivation, property, schools, amenities, transport and environment. An area can be a postcode or a place name.

### 3.3 How a call travels

1. The client reads its config and runs `npx -y @oga-mcp/server` with `OOGA_API_KEY` in the environment. npx downloads the package on first use and caches it. Node 18 or later is required.
2. The server refuses to start without a key, or with a key that does not begin with `oga_`.
3. It calls `GET /v1/me`. If the plan has no MCP access it prints which plan the key is on and exits. Otherwise it prints the plan, the engine version and the training-capture state for that key.
4. When the client completes the MCP handshake, the server records the client's name and version and sends them in every request's User-Agent: `onegoodarea-mcp-server/1.0.12 (claude-ai/1.2.3)`. The API reads that header, marks the call `source: mcp`, and classifies the host as claude-desktop, claude-code, cursor or other. That is what the PostHog MCP adoption dashboard breaks down.
5. Each tool call becomes one or more API requests with `Authorization: Bearer oga_...`. The result is rendered as text and returned to the client. Errors from the API are passed through in the text so the assistant can explain them.
6. Nothing is cached in the server and nothing is stored on the user's machine beyond the npx package cache.

### 3.4 Who may use it, and at what rate

MCP access is a flag on the plan. In the code, the flag is on for the plan ids `sandbox`, `growth` and `enterprise`, and off for `starter`, `build`, `scale` and every legacy consumer plan. The README says the server is included on the free Developer tier and every paid package. Licences are assigned by hand, so whoever sets up the first Build or Decision licence must put it on a plan id with the flag on, or the customer's MCP server will refuse to start.

Quotas come from the API, not the server. The sandbox plan allows 200 API calls a month, and a tool that makes two requests spends two. Per-minute limits are by tier: 5 for anonymous, 30 for logged_in and basic, 120 for the paid tier, unlimited for the two internal types. A sandbox key resolves to the basic tier. All free traffic also shares one daily cap. Plain-English questions have their own monthly allowance per plan.

The tier also chooses which language models answer `find_areas`. The paid tier gets a chain that starts with Claude Sonnet 4.5. The free tiers get a chain of free third-party models, with the caveat on the docs page that those providers may retain prompts. Today that free chain has no working member (section 4.4).

### 3.5 Data policy

By default, questions sent to `find_areas` and full `score_postcode` requests and responses are kept for 365 days to improve the planner and the brief composer. The owner of a key can switch that off on the API usage page, per key, and the server prints the current state at every start. The policy page is linked from the README and the docs. Operational logs (which tool, when, by which key) are kept either way. This default is one of the partner-readiness points still open from AR-1067: organisation keys should probably default to off.

### 3.6 Engineering state

- **Code.** `mcp/src`: `server.ts` (startup, entitlement check, host client, dispatch), `api-client.ts` (one HTTP client, the User-Agent, the response types mirrored from the contracts package), `methodology-data.ts` (static text for `methodology_for`), and sixteen files under `tools/` (one per tool plus formatters). One runtime dependency, the official MCP SDK.
- **Tests.** 183 tests in 16 files: one per tool, the value formatter, the User-Agent classifier (imports the API's own classifier so the two cannot drift), the registry metadata (fails if the version differs between package.json, server.json, the well-known manifest and the lock file), the mirror workflow (pins licence, links, exclusions and the secret name), and a no-em-dash sweep.
- **CI.** `mcp/` is not an npm workspace, so the root `npm test` skipped it until 13 October; AR-1118 added a dedicated job that installs, builds and tests `mcp/` on every push (21 seconds).
- **Release.** Bump the version in five places (package.json, server.json twice, the well-known manifest twice, the lock file root twice), merge, then you run from `mcp/` in PowerShell: `npm login`, `npm publish --access public`, `mcp-publisher.exe login dns` with the private key file, `mcp-publisher.exe publish`. The registry had an outage on the evening of 12 October; the retry an hour later worked. The mirror syncs itself on merge.
- **Where usage is recorded.** `activity_events` rows carry `metadata.source = 'mcp'` and `metadata.client_app`; `query_planner_logs` rows carry `source = 'mcp'`; PostHog dashboard 1011188 ("MCP adoption") reads the same classification from the API's spans.

### 3.7 History

| Date | What happened |
|---|---|
| 5 May 2026 | Server scaffold and the first tool, `score_postcode` (AR-144) |
| 28 to 30 June | Hygiene and 1.0.0 (AR-365); Signals tools (AR-366); Intelligence tools (AR-367); Monitor tools (AR-368); `area_brief` (AR-369); docs page rewrite for eleven tools (AR-370); npm scope renamed to `@oga-mcp/server` (AR-371); first clean publish, 1.0.0 to 1.0.3 on 29 and 30 June; "MCP is live" announcement bar (AR-374); MCP source captured on activity events and an adoption view (AR-375); data policy surface and training toggle (AR-385); `watch_portfolio` false-failure hotfix (AR-386) |
| 17 July | MCP granted on the free Developer tier to honour the pricing page (AR-487); the £29 self-serve MCP add-on and the dead checkout paths removed (AR-489) |
| 4 to 8 August | Methodology text rebuilt (AR-696); agent readiness: `llms.txt`, AI crawler rules, crawlable OpenAPI, the `/ai` page, the well-known manifest (AR-773, AR-780) |
| 23 to 24 September | 1.0.4 to 1.0.6: explanations name their sources and the server reads the live engine version (AR-972); one value formatter with units and ordinals in words (AR-974); API host moves to api.onegoodarea.com (AR-862) |
| 1 October | 1.0.7: signals ordered by period, load or release date (AR-1007) |
| 4 October | 1.0.8: portfolio changes say why a value moved; the cause filter (AR-977) |
| 9 October | 1.0.9: company line and builder story in the listing (AR-1065); 1.0.10: registry metadata, server version read from package.json (AR-1092) |
| 10 October | 1.0.11: registry name `com.onegoodarea/oga-mcp` with DNS verification, host client in the User-Agent (AR-1092, AR-1093); listed in the official MCP Registry at 17:30 UTC; registry name on docs, changelog and llms.txt (AR-1095); escape hatch removed and em dashes swept (AR-1096); public mirror live (AR-1097); directory submissions filed |
| 12 October | 1.0.12: methodology text matches engine 1.12.5 and WIMD 2025; `get_portfolio_changes` text corrected (AR-1103); registry publish succeeded on the second attempt |
| 13 October | The language-model chain behind `find_areas` restored for paid tiers; AR-1118 raised for the rest |

---

## 4. How it is going

### 4.1 Distribution signals

**npm downloads by month.**

| Month | Downloads | What was happening |
|---|---|---|
| June (from the 29th) | 486 | launch, four publishes in two days |
| July | 158 | no publishes |
| August | 54 | no publishes |
| September | 505 | three publishes on the 23rd and 24th |
| October, 1st to 13th | 928 | six publishes |

Last 30 days to 11 October: 1,426. Last 7 days: 574. The daily series for the last two weeks reads 3, 160, 20, 16, 158, 24, 0, 5, 52, 262, 188, 43, 0, 0. The four large days are 1, 4, 9 and 10 October, which are exactly the publish days of 1.0.7, 1.0.8, 1.0.10 and 1.0.11. Days without a publish sit between zero and fifty. Registry mirrors, security scanners and the MCP aggregators fetch every new version; that traffic is what the spikes are. The quiet-day baseline of a few dozen a day includes npx cache refreshes from whoever has the server configured, which today is us and possibly a handful of people who tried it.

**The registry.** Live since 10 October, two versions listed, 1.0.12 marked latest. The registry does not publish install or view counts.

**The mirror.** Zero stars, zero forks, zero watchers after three days. Glama indexes repositories tagged `mcp`; the claim button appears once it has crawled the mirror.

**The website.** The docs page had 11 visitors in the 30 days to 11 October, against 163 for the home page and 43 for the changelog.

### 4.2 Usage signals

**Calls the API recorded as coming through the MCP server, all time.**

| Month | Calls | Accounts |
|---|---|---|
| June | 17 | 1 |
| August | 78 | 1 |
| September | 119 | 1 |
| October (to the 13th) | 1 | 1 |

The one account is ours. External accounts: 0 calls, 0 accounts, ever. The last MCP call of any kind was on 3 October.

**By tool, last 90 days (our own traffic).** Score 82, area profile 61, signals by category 39, peers 8, plain-English query 5, portfolio changes 3. Portfolio creation events: 8, all ours. Plain-English questions through MCP, all time: 10, of which 7 answered.

**Host client.** Every recorded MCP call is classified `other`, because the host-client tagging only shipped in 1.0.11 on 10 October and nothing has called since. The adoption chart on the PostHog dashboard is empty by construction until an external client with 1.0.11 or later makes a call.

**Accounts.** 35 external sign-ups since March; 10 hold API keys; 5 have called the API by any route; 0 through MCP.

### 4.3 Reading the two together

Downloads are not usage. The honest sentence is: the server is published, listed, documented and tested, and nobody outside the company has run it against the API. That is not unusual thirteen weeks after launch for a server whose value needs a key, a sign-up and a reason to ask about British neighbourhoods, and it is the reason the traction scoreboard already separates the two signals. Three things would change the picture, in order of likelihood: a partner's engineer configuring it during a pilot (Huq is live; Infabode runs an AI hub that consumes MCP and API), a directory listing being accepted and sending curious developers, and the hosted endpoint removing the install step altogether.

The first real signal will look like this: one `activity_events` row with `source = 'mcp'` and an external `user_id`, a `client_app` of claude-desktop, claude-code or cursor, and a tool name. Section 8 has the query.

### 4.4 This week's incident, and what it says about the MCP surface

`find_areas` is the only tool that needs a language model, because the API's planner translates the question into a typed plan before the database runs it. Between about 8 October and 14:59 today every such question returned `422 llm_error`, for every tier. The chain of causes: the Anthropic balance ran out; the free models the chain fell back to (one on OpenRouter, one on OpenCode) had been withdrawn by their hosts; the first replacement key was organisation-scoped and Anthropic refuses those without a workspace header our client does not send; the per-provider failures were logged at a level production does not show. A key scoped to the Default workspace fixed the paid tiers at 14:59, and the Render log now shows Sonnet 4.5 answering first time, in 2 to 5 seconds. The other ten tools never stopped working.

The part that matters for MCP: a sandbox key resolves to the basic tier, whose chain is only the withdrawn free models. So every external MCP user who tried `find_areas` between early October and 17:39 on 13 October got an error. Nobody reported it, which matches the usage numbers. AR-1118 (merged 13 October, 904212d8) replaced the free models with ones present in the hosts' public lists, raised the per-hop failure logs to warn, and put the MCP tests in CI; an anonymous question on production, which runs the same first hop as a sandbox key, answered in 7.4 seconds warm. The DeepSeek entries still have no key on Render.

---

## 5. Scalability

### 5.1 The server itself

The server has no state, no database, no cache and no network listener. Each user runs their own copy on their own machine, started by their client, talking over pipes. A thousand users means a thousand processes on a thousand laptops that cost us nothing. Concurrency, memory and uptime of the server are the user's. Node is the only requirement, and npx handles installation and upgrades (a user who restarts their client gets the latest version). The package has one dependency and no native code. There is nothing to scale here; everything that scales is behind the API.

### 5.2 The API behind it

- **Hosting.** One Render web service, Docker image, Frankfurt, free plan: a fraction of a CPU and 512 MB, and it spins down after 15 minutes without traffic. The first request after that waits 30 to 60 seconds for the container to start, run the migrations and bind the port. Today's measurements showed it: 39 and 30 seconds on first contact, 0.3 to 5 seconds once warm. For an assistant that calls a tool mid-conversation, a minute is a failed call in the user's eyes. The daily probe keeps the instance warm during the day but not around the clock.
- **Database.** Neon Postgres. Reads for signals and scores are store-first: a profile for a London postcode is served from the store in about half a second plus a live flood check of 2.5 seconds; a score is the profile plus the engine. The store is designed for this and is the part that scales best.
- **Limits.** Per-minute by tier (5, 30, 120, unlimited), a monthly allowance by plan (200 on sandbox), a shared daily cap for all free traffic, and a monthly allowance of plain-English questions. These protect the instance; they also mean a sandbox user exhausts their month in a long afternoon of `compare_postcodes` calls (eight areas is eight calls).
- **Latency today, warm.** Signals profile 3 seconds (flood fan-out dominates), score about 3 seconds, compare of two areas 5 seconds, plain-English rank 2 to 3 seconds, the first plain-English call after a quiet period 16 seconds.

### 5.3 The language-model chain

`find_areas` costs money and depends on third parties. On the paid tier the planner uses Claude Sonnet 4.5 at Anthropic's list price; a planner prompt is a few thousand tokens, so a question costs on the order of a cent (an estimate, not a measured figure). The chain is seven hops long on the superuser tier and one hop long on the anonymous tier. Three single points of failure showed themselves this month: a prepaid balance that ran out without an alert, free models that disappear without notice, and a key format that changed under us. None of them was visible from our logs. The fix for visibility is in AR-1118; the fix for the balance is auto-reload or a spend alert in the Anthropic console; the fix for free models is to stop depending on them or to check them daily.

### 5.4 What breaks first as adoption grows

| Scale | What gives way | What fixes it |
|---|---|---|
| 10 active external users | Nothing in the server. The cold start annoys the first person each morning. | Keep the probe; accept it |
| 100 active users | Cold starts become the main complaint; the free-tier daily cap and the 200-call sandbox allowance are hit by normal exploration; the planner's monthly cost becomes a line item; every incident is found by a user, not by us | A paid Render instance (always on); a sandbox allowance sized for exploration; warn-level logs and an alert on `llm_error` rate; a spend alert on the provider |
| 1,000 active users | npx install and a pasted key are the top of the funnel and they leak most people; support questions about config files; the by-hand publish procedure is the bottleneck for fixes; one instance in one region | The hosted endpoint over Streamable HTTP with OAuth (no install, works in web clients); a CI-driven publish; at least two instances behind Render's load balancing or a move to the container host the Containerfile already supports |

### 5.5 What scales without work

The tool surface grows at zero marginal cost: a new API endpoint becomes a new tool in one file and one test. The protocol handles versioning: clients always run the latest. The entitlement, quota, metering and analytics all live in the API and already apply to MCP traffic, so a licensed partner using Claude Code is metered exactly like one using curl. The registry listing is permanent. The mirror syncs itself.

---

## 6. What it could become

### 6.1 Now (this quarter, roadmap row N12)

- **Listings live.** The awesome-mcp-servers merge, the mcp.so approval and the Glama claim are the three outstanding submissions. One accepted listing closes AR-1097.
- **MCPB bundle.** A one-click install file for Claude Desktop, which removes the config-file step and is the format Smithery accepts. AR-1101.
- **Sandbox questions working again.** Done 13 October (AR-1118). A free-tier question now answers in about 7 seconds on a free hosted model, with the per-hop logs to see when a free model disappears again.
- **The adoption chart populated.** It fills on its own when the first external client with 1.0.11 or later calls. The weekly number to watch is external accounts calling through MCP, not downloads.
- **Training default for organisation keys.** Off by default, per the partner-readiness index.

### 6.2 Next (roadmap row X6, next year)

**A hosted endpoint.** The same eleven tools served over Streamable HTTP from api.onegoodarea.com, with OAuth so the user signs in once instead of pasting a key. An agent then connects to a URL. This is what Claude.ai web connectors, ChatGPT connectors, Smithery and most enterprise agent platforms expect, and it is the single biggest step for adoption because it removes Node, npx, config files and key handling from the funnel. It needs an authorisation design (which account the token represents, how organisation members share one licence, how metering attributes calls) and it makes the Render instance a real dependency. The note from August called this "Dad's product track"; it is the one item here that is architecture rather than packaging.

**Tool definitions generated from the contracts.** Today each tool's input schema is hand-written in the server and the tests pin it to the API. Generating the definitions from the Zod schemas in `packages/contracts` means a new field in the API appears in every client the day it ships, and an argument that fails validation fails the same way everywhere.

### 6.3 The tool surface, following the products

Each item is an API capability that exists or is planned and has no MCP tool yet.

- **Resolve.** `resolve_place(input)` returning the permanent place id, the resolved neighbourhood, the status of a retired postcode, and the share when an input touches several places. This is the registry's front door and it is what Huq's footprints and the granularity work (AR-1088) will need first.
- **History as of a date.** The store keeps dated periods. A `signals_as_of(area, date)` tool, and a `what_changed(area, since)` tool for one place rather than a portfolio, would make the "reliable, current, traceable" line concrete inside a conversation.
- **Levers inside the tools.** A key that belongs to an organisation with a bundle or a preset should get them applied automatically, with the response saying so, exactly as `/v1/query` now sends `X-Bundle-Applied`. Tools to list and switch presets would follow.
- **Coverage and freshness.** Roadmap row X4 describes a per-signal, per-nation coverage and freshness surface. As a tool, `coverage(signal?)` lets an agent answer "do you know this, and how old is it" before it asks for the value, which is the machine-readable form of knowing what we do not know.
- **Polygons and points.** When slices 1 and 2 of the granularity plan land, `area` arguments accept a coordinate or an outline, and the response carries which places it touches and how much of each. No new tool, a wider argument.
- **Webhooks.** `watch_portfolio` creates the portfolio; a `subscribe(portfolio_id, url)` tool would complete the Monitor loop from inside an assistant.
- **Resources and prompts.** MCP has two other primitives besides tools. Resources let a client read documents by URI: the methodology registry, the signal catalogue, the glossary. Prompts are reusable templates: "brief this site for a lender" as a one-click prompt rather than a tool the model has to discover. Both are cheap to add and make the server more legible to a user browsing it.
- **An evaluation harness for `find_areas`.** A fixed set of questions with expected plans, run on every release and published as a number. The roadmap's "Beyond" section promises that number improves every quarter; nothing measures it yet.

### 6.4 Commercially

- **The funnel.** Sandbox key, MCP in the engineer's own tools, then a licence. The server is free on sandbox for exactly this reason, and the £29 add-on was removed in July because a per-seat charge on the on-ramp made no sense. Keep it free; meter the API.
- **Partners as distribution.** Infabode's AI hub consumes MCP and API, which makes a partnership there a listing in front of its users. Huq's engineers can run the whole engine inside Claude during the joint test without reading the API reference. Both are routes that need the hosted endpoint less than a working `find_areas`.
- **What to measure.** Weekly: external accounts calling through MCP, calls by host client, the share of `find_areas` calls that return a plan. Monthly: sandbox keys created from the docs page, conversions from sandbox to pilot. The roadmap's 5,000 and 10,000 downloads a month are mirror traffic targets and should be replaced by those.
- **What not to do.** Do not describe it as a lookup API: the value is the engine's provenance and versioning, which the server exposes untouched. Do not claim pinning: versions are disclosed, never frozen. Do not let the server compose prose or numbers client-side; every line must trace to a response. Do not charge for the server itself.

---

## 7. Decisions for Pedro and Marcos

1. **Hosting.** Move the API off the free Render plan before any partner runs the server in a pilot, or accept the minute-long cold start until the hosted endpoint forces the move.
2. **Licence plan ids.** Which plan id a Build or Decision licence is set to, given that MCP access is on for `sandbox`, `growth` and `enterprise` and off for `build` and `scale` in the code.
3. **Free-tier questions.** Whether sandbox keys keep a free-model chain (with the prompt-retention caveat) or get a small allowance on the paid chain, which costs about a cent a question.
4. **Training capture default.** Off for organisation keys, as the partner-readiness index recommends.
5. **The hosted endpoint.** Whether X6 moves into the next quarter once one directory listing and the MCPB bundle are done, and who designs the auth model.
6. **The measure.** Replace the downloads target with external accounts calling through MCP per week.

---

## 8. Figures and how to refresh them

| Figure | Value on 13 October 2026 | Source |
|---|---|---|
| Published version | 1.0.12 (npm `latest`; registry isLatest) | `npm view @oga-mcp/server version`; registry search URL below |
| Registry entry | `com.onegoodarea/oga-mcp`, active, published 12 Oct 18:26 UTC | `https://registry.modelcontextprotocol.io/v0/servers?search=com.onegoodarea` |
| npm, last 30 days | 1,426 (12 Sep to 11 Oct) | `https://api.npmjs.org/downloads/point/last-month/@oga-mcp/server` |
| npm, by month | Jun 486, Jul 158, Aug 54, Sep 505, Oct 1 to 13: 928 | `.../downloads/range/2026-06-01:2026-10-13/@oga-mcp/server` |
| Mirror | 0 stars, 0 forks, MIT, pushed 12 Oct | `gh api repos/OneGoodArea/oga-mcp` |
| MCP calls recorded, all time | 215, one internal account; external 0 | `activity_events` where `metadata->>'source' = 'mcp'`, joined to `users` with the internal filter from `docs/_local/traction-counts.mjs` |
| MCP calls by tool, 90 days | score 82, area 61, category 39, peers 8, query 5, changes 3 | same table, grouped by `event` |
| Plain-English questions via MCP | 10 (7 answered) | `query_planner_logs` where `source = 'mcp'` |
| External key holders / MCP users | 10 / 0 | `api_keys` joined to `users`; `activity_events` as above |
| Docs page visitors, 30 days | 11 (to 11 Oct) | PostHog web analytics, internal traffic filtered |
| Tests | 183 in 16 files | `cd mcp && npm test` |
| Open tickets | AR-1097 (listings), AR-1101 (MCPB, Smithery); AR-1118 (LLM chain, CI) Done 13 Oct | Jira project AR |

The first external MCP call, when it happens, is found with: `select e.created_at, e.event, e.metadata->>'client_app' from activity_events e join users u on u.id = e.user_id where e.metadata->>'source' = 'mcp' and not (internal filter) order by 1 limit 5`.
