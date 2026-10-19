import type { PackPlace, PackSignal, ResearchPack, Scoreboard } from '@vigoros/contracts'
import type { Env } from './env'
import { samplePack, sampleScoreboard } from './sample'

/**
 * The only code that talks to OneGoodArea's API and PostHog. Read-only by construction: GET on
 * the profile, catalogue and change endpoints; no portfolio, webhook or account call exists here.
 * In sample mode nothing leaves the machine.
 */

type Json = Record<string, unknown>

const get = async (base: string, key: string, path: string, params: Record<string, string>) => {
  const url = new URL(base.replace(/\/$/, '') + path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${key}`,
      accept: 'application/json',
      'user-agent': 'oga-worker/1',
    },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`${path} ${res.status} ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as Json
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null)

/** Maps one API signal to the pack shape. Unknown fields are dropped, never invented. */
const toSignal = (s: Json): PackSignal => {
  const period = (s['period'] ?? {}) as Json
  const conf = s['confidence'] as Json | number | undefined
  return {
    key: String(s['key'] ?? ''),
    category: String(s['category'] ?? ''),
    label: String(s['label'] ?? s['key'] ?? ''),
    value: typeof s['value'] === 'number' || typeof s['value'] === 'string' ? s['value'] : null,
    unit: str(s['unit']),
    direction: str(s['direction']),
    percentile: num(s['percentile']) ?? num((s['normalised'] as Json | undefined)?.['percentile']),
    confidence:
      typeof conf === 'number' ? conf : (num(conf?.['value']) ?? num(conf?.['score']) ?? 0),
    confidenceReason: typeof conf === 'object' && conf ? (str(conf['reason']) ?? '') : '',
    source: str(s['source']) ?? str((s['source'] as Json | undefined)?.['name']) ?? '',
    periodStart: str(period['start']) ?? str(period['from']) ?? '',
    periodEnd: str(period['end']) ?? str(period['to']) ?? '',
    released: str(s['released']) ?? str(s['released_at']),
    loaded: str(s['loaded']) ?? str(s['loaded_at']),
  }
}

export const researchPack = async (
  e: Env,
  places: string[],
  grain: string,
  changesSinceDays: number,
): Promise<ResearchPack> => {
  if (e.OGA_MODE === 'sample' || !e.OGA_API_KEY) return samplePack(places)
  const out: PackPlace[] = []
  const notes: string[] = []
  let methodologyVersion = ''
  for (const input of places) {
    try {
      const area = await get(e.OGA_API_BASE, e.OGA_API_KEY, '/area', { postcode: input, grain })
      const place = (area['place'] ?? {}) as Json
      const signals = Array.isArray(area['signals'])
        ? (area['signals'] as Json[]).map(toSignal)
        : []
      methodologyVersion = String(
        area['methodology_version'] ?? area['methodologyVersion'] ?? methodologyVersion,
      )
      out.push({
        input,
        placeId: String(place['id'] ?? area['place_id'] ?? ''),
        name: String(place['name'] ?? area['name'] ?? input),
        grain,
        district: str(place['district']) ?? str(area['district']),
        region: str(place['region']) ?? str(area['region']),
        nation: str(place['nation']) ?? str(area['nation']),
        areaType: str(place['area_type']) ?? str(area['area_type']),
        signals,
        changes: [],
        gaps: signals
          .filter((s) => s.value === null)
          .map((s) => ({
            signalKey: s.key,
            reason: s.confidenceReason || 'withheld by the engine',
          })),
      })
    } catch (err) {
      notes.push(`${input}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  void changesSinceDays // the change feed is per portfolio; wired when the worker holds one
  return {
    mode: 'live',
    fetchedAt: new Date().toISOString(),
    apiBase: e.OGA_API_BASE,
    methodologyVersion,
    places: out,
    sources: [...new Set(out.flatMap((p) => p.signals.map((s) => s.source)).filter(Boolean))],
    notes,
  }
}

export const scoreboard = async (e: Env, days: number): Promise<Scoreboard> => {
  if (e.OGA_MODE === 'sample' || !e.POSTHOG_API_KEY) return sampleScoreboard()
  // PostHog web analytics overview for the project; internal traffic is filtered on the PostHog side.
  const url = `${e.POSTHOG_HOST.replace(/\/$/, '')}/api/projects/${e.POSTHOG_PROJECT_ID}/web_analytics/overview?date_from=-${days}d`
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${e.POSTHOG_API_KEY}`, accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`posthog ${res.status}`)
  const body = (await res.json()) as Json
  const site: Record<string, number | string> = {}
  for (const [k, v] of Object.entries(body))
    if (typeof v === 'number' || typeof v === 'string') site[k] = v
  return {
    mode: 'live',
    readAt: new Date().toISOString(),
    site,
    accounts: {},
    mcp: {},
    pipeline: {},
    sources: [url],
    notes: [
      'Accounts, MCP and pipeline figures need the traction script in the OneGoodArea repo; not read here.',
    ],
  }
}
