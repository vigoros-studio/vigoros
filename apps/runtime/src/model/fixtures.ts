/**
 * Schema-valid fixtures for the fake adapter. They read like plausible work so the headquarters
 * can be exercised end to end, and every one is labelled SIMULATED so none of it can pass as a
 * real finding. The figures come from OneGoodArea's own sample pack for SE15 5DP (12 October 2026,
 * methodology 1.12.5), copied, not computed; nothing here came from a model or a live call.
 */
const SIM = '[SIMULATED]'
const SAMPLE = 'docs/oga/OneGoodArea-Infabode-sample-postcodes-2026-10.md'

const cite = (
  signalKey: string,
  value: string,
  unit: string | null,
  periodStart: string,
  periodEnd: string,
  source: string,
  confidence: number,
) => ({
  signalKey,
  placeId: 'oga_pl_YXC6XP2HFFQEA',
  placeName: 'Peckham (E01004067), Southwark',
  value,
  unit,
  periodStart,
  periodEnd,
  source,
  confidence,
  methodologyVersion: '1.12.5',
})

export const FIXTURES: Record<string, unknown> = {
  ContentPlan: {
    week: `${SIM} week of 19 October 2026`,
    pieces: [
      {
        surface: 'change_digest',
        title: `${SIM} Peckham: the property median moved from one sale to forty-three`,
        audience: 'property_data',
        places: ['SE15 5DP'],
        angle:
          'Methodology 1.4.0 replaced a one-sale neighbourhood median with the official MSOA series. The same place now reads £500,000 and +20.5% from 43 sales instead of £230,000 and -55.5% from one. A method change, labelled as such.',
        why: 'Property data firms ask about provenance and refresh first; this is the clearest worked example of versioning and disclosure in the sample pack.',
        priority: 1,
      },
      {
        surface: 'linkedin',
        title: `${SIM} One figure: 731.9 recorded crimes per 1,000 residents in a high-street neighbourhood`,
        audience: 'location_data',
        places: ['SE15 5DP'],
        angle: 'Why the count, the rate and the percentile are served together.',
        why: 'Location data companies work with footfall; the resident denominator is exactly their question.',
        priority: 2,
      },
    ],
    skipped: [
      {
        idea: 'A district page for Westmorland and Furness',
        why: 'Only one rural neighbourhood in the pack; a district page needs the district aggregate the roadmap ships in N3.',
      },
    ],
    notes: `${SIM} Fixture plan. No scoreboard was read and no model was called.`,
  },
  ContentDraft: {
    surface: 'change_digest',
    title: `${SIM} Peckham: the property median moved from one sale to forty-three`,
    audience: 'property_data',
    summary:
      'A method change, not a market move: the neighbourhood median for SE15 5DP now comes from the ONS small-area series for its group, with the sales behind it named.',
    body: `In August the neighbourhood around SE15 5DP served a median sale price of £230,000 and a year-on-year change of -55.5%, from a single sale, at 40% confidence. On 12 October the same place serves £500,000 and +20.5% year on year, from 43 sales in group E02000828 for the year ending March 2026, at 90% confidence.

Nothing happened to Peckham's prices in between. What changed is the method. Methodology 1.4.0 inherits the median and its trend from the neighbourhood group, the ONS House Price Statistics for Small Areas, and serves no trend from fewer than ten sales. The seven sales recorded in the neighbourhood itself are kept as their own signal at 40% confidence, with the reasoning "treat the figure as indicative".

Monitor labels this change as caused by the method, not the source, so a portfolio that holds this place sees the cause beside the move. The methodology version on every response is 1.12.5.

If you hold addresses in Southwark, send us your locations and read the same figures for your own book.`,
    citations: [
      cite(
        'property.median_price',
        '500000',
        'GBP',
        '2025-04-01',
        '2026-03-31',
        'ONS HPSSA, group E02000828, 43 sales',
        90,
      ),
      cite(
        'property.price_change_yoy',
        '20.5',
        '%',
        '2025-04-01',
        '2026-03-31',
        'ONS HPSSA, group E02000828',
        90,
      ),
      cite(
        'property.sales_count',
        '7',
        'sales',
        '2025-04-01',
        '2026-03-31',
        'HM Land Registry Price Paid',
        40,
      ),
    ],
    methodologyVersion: '1.12.5',
    callToAction: 'Send us your locations: up to 1,000 postcodes enriched within two working days.',
    hashtags: ['placedata', 'proptech'],
    withheld: null,
  },
  FactCheck: {
    verdict: 'pass',
    claimsChecked: 9,
    issues: [],
    notes: `${SIM} Fixture check: every figure in the body matched a row in the sample pack (${SAMPLE}). No model was called.`,
  },
  EditorialReview: {
    headline: `${SIM} Publish "Peckham: the property median moved from one sale to forty-three"`,
    summary:
      'A change digest for property data firms built on three cited rows from the 12 October sample pack. It shows versioning and disclosure on a real place, names the sales behind the figure, and ends with the sample-enrichment offer. The fact-check passed with nine claims verified.',
    recommendation: 'approve',
    reasoning:
      'It answers the provenance question a property data buyer asks first, with figures that can be checked against the API today.',
    edits: ['Tightened the first sentence to lead with the move, not the date.'],
    revisedBody: null,
  },
  ApprovalItem: {
    headline: `${SIM} Publish the Peckham change digest`,
    summary: 'Change digest, property data audience, three cited rows, fact-check passed.',
    recommendation: 'approve',
    reasoning: 'Clean provenance story; low risk; the offer is the real one.',
  },
  DirectorPlan: {
    summary: `${SIM} The founder asked for a piece; the Managing Director starts one content workflow.`,
    startWorkflow: true,
    surface: 'change_digest',
    audience: 'property_data',
    focus: 'Peckham property median after methodology 1.4.0',
    guidance: 'Lead with the method change; name the sales behind the figure.',
    places: ['SE15 5DP'],
  },
  Acknowledgement: {
    summary: `${SIM} Acknowledged. This is a fixture; no model read the instruction.`,
    actions: ['Read the instruction', 'Confirm it fits the current plan'],
    needsFounder: null,
  },
  Briefing: {
    greeting: `${SIM} Morning briefing from the fake adapter: no model read the rows.`,
    highlights: ['One content workflow in flight', 'Nothing published since the last briefing'],
    decisionsAwaiting: [],
  },
}
