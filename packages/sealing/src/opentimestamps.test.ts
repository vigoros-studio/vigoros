import { describe, expect, it } from 'vitest'
import { bytesToHex, hexToBytes } from './merkle'
import {
  DEFAULT_CALENDARS,
  OtsClient,
  OtsError,
  getUpgrade,
  parseAttestations,
  stampDigest,
} from './opentimestamps'

const DIGEST = '35a4480c6d38b08285b64bfc3fade6e11091dec63998328015bae4161077add1'

// Real response from a.pool.opentimestamps.org for DIGEST, captured 2026-09-18. The pool
// forwarded to alice, whose /timestamp/<commitment> then answered
// "Pending confirmation in Bitcoin blockchain" for LIVE_COMMITMENT and "Not found" for DIGEST.
const LIVE_RESPONSE =
  'f0084a927a38ba2fdee108f0106b4ed3c4cbb4a363745f92107f5fbf8708f12016349f9edf14bf8ceb02687b9870a79f' +
  'f3f532b8e08664e4bb3a4425afad5bb708f1208de76ea5583e41f0eca0f004241e1eeb11d5a856564daf94db4d7d9a7a' +
  '3b09af08f1046aadb489f008ca7f022bb8e1944a0083dfe30d2ef90c8e2e2d68747470733a2f2f616c6963652e627463' +
  '2e63616c656e6461722e6f70656e74696d657374616d70732e6f7267'
const LIVE_COMMITMENT =
  '6aadb48975d7cad36e1b99ef6e90b2b8b32309720ed40e4c66724deec35c513f4dd2b969ca7f022bb8e1944a'

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body: Uint8Array | null
}

type Route = (call: Call) => Response

const bin = (bytes: Uint8Array, status = 200): Response =>
  new Response(bytes, { status, headers: { 'Content-Type': 'application/octet-stream' } })

/** Build a fetch mock. Routes are matched by URL prefix; unmatched URLs return 500. */
const mockFetch = (routes: Record<string, Route>): { fetchImpl: typeof fetch; calls: Call[] } => {
  const calls: Call[] = []
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => {
      headers[k.toLowerCase()] = v
    })
    const body = init?.body instanceof Uint8Array ? init.body : null
    const call: Call = { url, method: init?.method ?? 'GET', headers, body }
    calls.push(call)
    const key = Object.keys(routes).find((prefix) => url.startsWith(prefix))
    const route = key === undefined ? undefined : routes[key]
    return route ? route(call) : new Response('unrouted', { status: 500 })
  }) as typeof fetch
  return { fetchImpl, calls }
}

describe('OtsClient.stamp', () => {
  it('POSTs the raw digest bytes with the OTS headers to the first calendar', async () => {
    const proof = hexToBytes(LIVE_RESPONSE)
    const { fetchImpl, calls } = mockFetch({ 'https://a.pool': () => bin(proof) })
    const client = new OtsClient({ calendars: ['https://a.pool', 'https://b.pool'], fetchImpl })

    const result = await client.stamp(DIGEST)
    expect(result.calendar).toBe('https://a.pool')
    expect(bytesToHex(result.proof)).toBe(LIVE_RESPONSE)

    expect(calls).toHaveLength(1)
    const call = calls[0] as Call
    expect(call.url).toBe('https://a.pool/digest')
    expect(call.method).toBe('POST')
    expect(call.headers['content-type']).toBe('application/x-www-form-urlencoded')
    expect(call.headers['accept']).toBe('application/vnd.opentimestamps.v1')
    expect(call.body).not.toBeNull()
    expect(bytesToHex(call.body as Uint8Array)).toBe(DIGEST)
    expect((call.body as Uint8Array).length).toBe(32)
  })

  it('falls back to the next calendar on 5xx, in order', async () => {
    const proof = new Uint8Array([1, 2, 3])
    const { fetchImpl, calls } = mockFetch({
      'https://a.pool': () => new Response('down', { status: 503 }),
      'https://b.pool': () => new Response('boom', { status: 500 }),
      'https://alice': () => bin(proof),
    })
    const client = new OtsClient({
      calendars: ['https://a.pool/', 'https://b.pool', 'https://alice'],
      fetchImpl,
    })
    const result = await client.stamp(DIGEST)
    expect(result.calendar).toBe('https://alice')
    expect(result.proof).toEqual(proof)
    expect(calls.map((c) => c.url)).toEqual([
      'https://a.pool/digest',
      'https://b.pool/digest',
      'https://alice/digest',
    ])
  })

  it('falls back when fetch itself rejects (network error)', async () => {
    const proof = new Uint8Array([9])
    let n = 0
    const fetchImpl = (async (input: string | URL | Request) => {
      n++
      const url = String(input)
      if (url.startsWith('https://a.pool')) throw new TypeError('fetch failed')
      return bin(proof)
    }) as typeof fetch
    const client = new OtsClient({ calendars: ['https://a.pool', 'https://b.pool'], fetchImpl })
    const result = await client.stamp(DIGEST)
    expect(result.calendar).toBe('https://b.pool')
    expect(n).toBe(2)
  })

  it('throws a typed OtsError listing every attempt when all calendars fail', async () => {
    const { fetchImpl } = mockFetch({
      'https://a.pool': () => new Response('', { status: 502 }),
      'https://b.pool': () => bin(new Uint8Array(0)), // 200 but empty is also a failure
    })
    const client = new OtsClient({ calendars: ['https://a.pool', 'https://b.pool'], fetchImpl })
    const err = await client.stamp(DIGEST).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(OtsError)
    const ots = err as OtsError
    expect(ots.code).toBe('all_calendars_failed')
    expect(ots.attempts).toEqual([
      { calendar: 'https://a.pool', status: 502 },
      { calendar: 'https://b.pool', status: 200 },
    ])
  })

  it('rejects a malformed digest before touching the network', async () => {
    const { fetchImpl, calls } = mockFetch({})
    const client = new OtsClient({ fetchImpl })
    await expect(client.stamp('abc')).rejects.toMatchObject({ code: 'invalid_digest' })
    await expect(stampDigest('https://x', 'zz'.repeat(32), fetchImpl)).rejects.toMatchObject({
      code: 'invalid_digest',
    })
    expect(calls).toHaveLength(0)
  })

  it('defaults to the public calendars', () => {
    expect(new OtsClient().calendars).toEqual(DEFAULT_CALENDARS)
    expect(DEFAULT_CALENDARS[0]).toBe('https://a.pool.opentimestamps.org')
  })

  it('throws no_calendars when configured with none', async () => {
    const { fetchImpl } = mockFetch({})
    await expect(new OtsClient({ calendars: [], fetchImpl }).stamp(DIGEST)).rejects.toMatchObject({
      code: 'no_calendars',
    })
  })
})

describe('parseAttestations', () => {
  it('recovers the pending attestation and commitment from a live calendar response', async () => {
    const atts = await parseAttestations(DIGEST, hexToBytes(LIVE_RESPONSE))
    expect(atts).toEqual([
      {
        kind: 'pending',
        uri: 'https://alice.btc.calendar.opentimestamps.org',
        commitment: LIVE_COMMITMENT,
      },
    ])
  })

  it('decodes a bitcoin attestation with a varuint height and follows forks', async () => {
    // sha256 -> fork { pending("https://c") | bitcoin(height 900000) }
    const height = 900_000 // varuint: a0 f7 36
    const uri = new TextEncoder().encode('https://c')
    const pendingPayload = new Uint8Array([uri.length, ...uri])
    const bytes = new Uint8Array([
      0x08,
      0xff,
      0x00,
      ...hexToBytes('83dfe30d2ef90c8e'),
      pendingPayload.length,
      ...pendingPayload,
      0x00,
      ...hexToBytes('0588960d73d71901'),
      3,
      0xa0,
      0xf7,
      0x36,
    ])
    const atts = await parseAttestations(DIGEST, bytes)
    const expected = bytesToHex(
      new Uint8Array(await crypto.subtle.digest('SHA-256', hexToBytes(DIGEST))),
    )
    expect(atts).toEqual([
      { kind: 'pending', uri: 'https://c', commitment: expected },
      { kind: 'bitcoin', height, commitment: expected },
    ])
  })

  it('rejects truncated, trailing and unknown-op input', async () => {
    await expect(parseAttestations(DIGEST, hexToBytes('f008aabb'))).rejects.toMatchObject({
      code: 'malformed_proof',
    })
    await expect(parseAttestations(DIGEST, hexToBytes(`${LIVE_RESPONSE}00`))).rejects.toMatchObject(
      { code: 'malformed_proof' },
    )
    await expect(parseAttestations(DIGEST, new Uint8Array([0x77]))).rejects.toMatchObject({
      code: 'malformed_proof',
    })
    await expect(parseAttestations(DIGEST, new Uint8Array([0x03]))).rejects.toMatchObject({
      code: 'unsupported_op',
    })
  })
})

describe('upgrade', () => {
  it('getUpgrade returns null on 404 and the bytes on 200', async () => {
    const upgraded = new Uint8Array([0xde, 0xad])
    const { fetchImpl, calls } = mockFetch({
      'https://alice/timestamp/aa': () => new Response('Pending confirmation', { status: 404 }),
      'https://alice/timestamp/bb': () => bin(upgraded),
    })
    expect(await getUpgrade('https://alice', 'aa', fetchImpl)).toBeNull()
    expect(await getUpgrade('https://alice', 'bb', fetchImpl)).toEqual(upgraded)
    expect(calls.map((c) => [c.method, c.url, c.headers['accept']])).toEqual([
      ['GET', 'https://alice/timestamp/aa', 'application/vnd.opentimestamps.v1'],
      ['GET', 'https://alice/timestamp/bb', 'application/vnd.opentimestamps.v1'],
    ])
  })

  it('getUpgrade throws on non-404 errors', async () => {
    const { fetchImpl } = mockFetch({ 'https://alice': () => new Response('', { status: 500 }) })
    await expect(getUpgrade('https://alice', 'aa', fetchImpl)).rejects.toMatchObject({
      code: 'http_error',
    })
  })

  it('OtsClient.upgrade with a proof queries the calendar named in the pending attestation', async () => {
    const upgraded = new Uint8Array([1])
    const { fetchImpl, calls } = mockFetch({
      'https://alice.btc.calendar.opentimestamps.org/timestamp/': () => bin(upgraded),
    })
    const client = new OtsClient({ calendars: ['https://ignored.example'], fetchImpl })
    const result = await client.upgrade(DIGEST, hexToBytes(LIVE_RESPONSE))
    expect(result).toEqual({
      calendar: 'https://alice.btc.calendar.opentimestamps.org',
      proof: upgraded,
    })
    expect(calls.map((c) => c.url)).toEqual([
      `https://alice.btc.calendar.opentimestamps.org/timestamp/${LIVE_COMMITMENT}`,
    ])
  })

  it('OtsClient.upgrade returns null when every calendar says 404', async () => {
    const { fetchImpl, calls } = mockFetch({
      'https://a.pool': () => new Response('Not found', { status: 404 }),
      'https://b.pool': () => new Response('Not found', { status: 404 }),
    })
    const client = new OtsClient({ calendars: ['https://a.pool', 'https://b.pool'], fetchImpl })
    expect(await client.upgrade(DIGEST)).toBeNull()
    expect(calls.map((c) => c.url)).toEqual([
      `https://a.pool/timestamp/${DIGEST}`,
      `https://b.pool/timestamp/${DIGEST}`,
    ])
  })

  it('OtsClient.upgrade throws when a calendar errors and none succeeds', async () => {
    const { fetchImpl } = mockFetch({
      'https://a.pool': () => new Response('Not found', { status: 404 }),
      'https://b.pool': () => new Response('', { status: 503 }),
    })
    const client = new OtsClient({ calendars: ['https://a.pool', 'https://b.pool'], fetchImpl })
    const err = await client.upgrade(DIGEST).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(OtsError)
    expect((err as OtsError).attempts).toEqual([
      { calendar: 'https://a.pool', status: 404 },
      { calendar: 'https://b.pool', status: 503 },
    ])
  })
})
