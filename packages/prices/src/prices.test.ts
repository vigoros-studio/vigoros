import { describe, expect, it } from 'vitest'
import { TiingoSource } from './tiingo'
import { StooqSource } from './stooq'
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

describe('StooqSource', () => {
  it('parses csv and maps symbols', async () => {
    const s = new StooqSource(mockFetch({ 's=shel.uk': 'Date,Open,High,Low,Close,Volume\n2026-09-17,1,2,0.5,2700.5,123\n' }))
    expect(StooqSource.symbolFor(shel)).toBe('shel.uk')
    expect(await s.fetchBars(shel, '2026-09-17', '2026-09-17')).toEqual([
      { day: '2026-09-17', close: 2700.5, adjClose: 2700.5, volume: 123 },
    ])
  })
})

describe('fetchUniverse', () => {
  it('falls back to the next source and reports failures', async () => {
    const tiingo = new TiingoSource({ apiKey: 'k', fetchImpl: mockFetch({ '/tiingo/daily/AAPL/prices': [{ date: '2026-09-17', close: 1, adjClose: 1 }] }) })
    const stooq = new StooqSource(mockFetch({ 's=shel.uk': 'Date,Open,High,Low,Close,Volume\n2026-09-17,1,2,0.5,2,3\n' }))
    const { ok, failed } = await fetchUniverse([aapl, shel, eur], '2026-09-17', '2026-09-17', {
      sourcesByVenue: { US: [tiingo], UK: [tiingo, stooq], FX: [tiingo], CRYPTO: [tiingo] },
    })
    expect(ok.map((o) => [o.assetId, o.source])).toEqual([['A', 'tiingo'], ['S', 'stooq']])
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
