import { describe, expect, it } from 'vitest'
import { TiingoSource } from './tiingo'
import { YahooSource } from './yahoo'
import { fetchUniverse } from './ingest'
import { TokenBucket, mapConcurrent } from './rate-limit'
import type { PriceSourceAsset } from './types'

const mockFetch = (routes: Record<string, unknown | string>): typeof fetch =>
  (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    const key = Object.keys(routes).find((k) => url.includes(k))
    if (!key) return new Response('not found', { status: 404 })
    const body = routes[key]
    return typeof body === 'string' ? new Response(body) : Response.json(body)
  }) as typeof fetch

const aapl: PriceSourceAsset = { assetId: 'A', vendorSymbol: 'AAPL', venue: 'US', assetClass: 'EQUITY' }
const shel: PriceSourceAsset = { assetId: 'S', vendorSymbol: 'SHEL', venue: 'UK', assetClass: 'EQUITY' }
const eur: PriceSourceAsset = { assetId: 'E', vendorSymbol: 'eurusd', venue: 'FX', assetClass: 'FX' }
const btc: PriceSourceAsset = { assetId: 'B', vendorSymbol: 'btcusd', venue: 'CRYPTO', assetClass: 'CRYPTO' }

describe('TiingoSource', () => {
  it('normalises equities, fx and crypto to PriceBar', async () => {
    const t = new TiingoSource({
      apiKey: 'k',
      fetchImpl: mockFetch({
        '/tiingo/daily/AAPL/prices': [{ date: '2026-09-17T00:00:00.000Z', close: 230, adjClose: 229.5, volume: 1000 }],
        '/tiingo/fx/eurusd/prices': [{ date: '2026-09-17T00:00:00.000Z', close: 1.1 }],
        '/tiingo/crypto/prices': [{ ticker: 'btcusd', priceData: [{ date: '2026-09-17T00:00:00.000Z', close: 60000 }] }],
      }),
    })
    expect(await t.fetchBars(aapl, '2026-09-17', '2026-09-17')).toEqual([
      { day: '2026-09-17', close: 230, adjClose: 229.5, volume: 1000 },
    ])
    expect((await t.fetchBars(eur, '2026-09-17', '2026-09-17'))[0]?.adjClose).toBe(1.1)
    expect((await t.fetchBars(btc, '2026-09-17', '2026-09-17'))[0]?.close).toBe(60000)
  })
  it('throws a typed error on http failure', async () => {
    const t = new TiingoSource({ apiKey: 'k', fetchImpl: mockFetch({}) })
    await expect(t.fetchBars(aapl, '2026-09-17', '2026-09-17')).rejects.toMatchObject({ status: 404, source: 'tiingo' })
  })
})

const chart = (ts: number[], close: (number | null)[], adj?: (number | null)[]) => ({
  chart: { result: [{ meta: { currency: 'GBp' }, timestamp: ts, indicators: { quote: [{ close, volume: close.map(() => 10) }], adjclose: adj ? [{ adjclose: adj }] : undefined } }], error: null },
})

describe('YahooSource', () => {
  it('maps symbols per venue', () => {
    expect(YahooSource.symbolFor({ ...shel, symbol: 'SHEL' })).toBe('SHEL.L')
    expect(YahooSource.symbolFor({ ...shel, symbol: 'BT.A' })).toBe('BT-A.L')
    expect(YahooSource.symbolFor({ ...eur, symbol: 'EURUSD' })).toBe('EURUSD=X')
    expect(YahooSource.symbolFor({ ...btc, symbol: 'BTC' })).toBe('BTC-USD')
    expect(YahooSource.symbolFor({ ...aapl, symbol: 'BRK.B' })).toBe('BRK-B')
  })
  it('parses the chart payload, drops null bars and out-of-range days, uses adjclose', async () => {
    const t = (d: string) => Math.floor(Date.parse(`${d}T15:30:00Z`) / 1000)
    const y = new YahooSource(mockFetch({ 'SHEL.L': chart([t('2026-09-15'), t('2026-09-16'), t('2026-09-17')], [2700, null, 2710], [2690, null, 2710]) }))
    expect(await y.fetchBars({ ...shel, symbol: 'SHEL' }, '2026-09-16', '2026-09-17')).toEqual([{ day: '2026-09-17', close: 2710, adjClose: 2710, volume: 10 }])
  })
  it('surfaces yahoo errors as typed errors', async () => {
    const y = new YahooSource(mockFetch({ 'NOPE.L': { chart: { result: null, error: { code: 'Not Found', description: 'No data found' } } } }))
    await expect(y.fetchBars({ ...shel, symbol: 'NOPE' }, '2026-09-17', '2026-09-17')).rejects.toMatchObject({ source: 'yahoo' })
  })
})

describe('fetchUniverse', () => {
  it('falls back to the next source and reports failures', async () => {
    const tiingo = new TiingoSource({ apiKey: 'k', fetchImpl: mockFetch({ '/tiingo/daily/AAPL/prices': [{ date: '2026-09-17', close: 1, adjClose: 1 }] }) })
    const t = Math.floor(Date.parse('2026-09-17T15:30:00Z') / 1000)
    const yahoo = new YahooSource(mockFetch({ 'SHEL.L': chart([t], [2]) }))
    const { ok, failed } = await fetchUniverse([aapl, { ...shel, symbol: 'SHEL' }, eur], '2026-09-17', '2026-09-17', {
      sourcesByVenue: { US: [tiingo], UK: [tiingo, yahoo], FX: [tiingo], CRYPTO: [tiingo] },
    })
    expect(ok.map((o) => [o.assetId, o.source])).toEqual([['A', 'tiingo'], ['S', 'yahoo']])
    expect(failed.map((f) => f.assetId)).toEqual(['E'])
  })
})

describe('rate limiting', () => {
  it('token bucket refills', async () => {
    const b = new TokenBucket(2, 1) // 1 token per ms
    await b.take(); await b.take()
    const t0 = Date.now(); await b.take()
    expect(Date.now() - t0).toBeLessThan(50)
  })
  it('mapConcurrent preserves order', async () => {
    const r = await mapConcurrent([3, 1, 2], 2, async (n) => { await new Promise((res) => setTimeout(res, n)); return n })
    expect(r.map((x) => (x.status === 'fulfilled' ? x.value : -1))).toEqual([3, 1, 2])
  })
})
