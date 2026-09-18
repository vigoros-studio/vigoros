/**
 * Minimal OpenTimestamps calendar client. No third-party library.
 *
 * Protocol (as spoken by the public calendars and their aggregator pools):
 *
 *   stamp:    POST https://<calendar>/digest
 *             body    = the raw 32 bytes of the SHA-256 digest
 *             headers = Content-Type: application/x-www-form-urlencoded
 *                       Accept: application/vnd.opentimestamps.v1
 *             200 body = binary serialized OpenTimestamps timestamp *relative to the digest*:
 *                        a chain of ops (append nonce, sha256, prepend, ...) ending in a
 *                        PENDING attestation that names the calendar holding the commitment.
 *
 *   upgrade:  GET  https://<calendar>/timestamp/<hex commitment>
 *             200 body = serialized timestamp continuing from that commitment down to a
 *                        BITCOIN attestation (block height).
 *             404      = the calendar has not yet anchored it (or does not know it).
 *
 * The bytes returned by `stamp` are stored verbatim as the proof. They are NOT a complete .ots
 * file. A complete .ots file can be assembled later by prepending the standard header:
 *
 *   magic   = 00 4f 70 65 6e 54 69 6d 65 73 74 61 6d 70 73 00 00 50 72 6f 6f 66 00 bf 89 e2 e8 84 e8 92 94
 *             ("\0OpenTimestamps\0\0Proof\0\xbf\x89\xe2\xe8\x84\xe8\x92\x94")
 *   version = 01                       (varuint 1)
 *   hash op = 08                       (SHA-256 tag)
 *   digest  = the 32 raw digest bytes
 *   ... followed by the stored calendar bytes.
 *
 * Verification against the Bitcoin chain is done with the reference `ots` CLI
 * (`ots verify <file>.ots`), not here. This module deliberately implements neither full
 * .ots serialization nor Bitcoin verification.
 *
 * What it does implement, because upgrading needs it: a small reader for the op/attestation
 * encoding, enough to walk the calendar's response and recover the *commitment* — the digest
 * as it stands right before the PENDING attestation. That commitment, not the original digest,
 * is what the calendar's `/timestamp/<hex>` endpoint is keyed on.
 */

import { bytesToHex, hexToBytes, sha256Bytes, asBufferSource } from './merkle'

export const DEFAULT_CALENDARS: readonly string[] = [
  'https://a.pool.opentimestamps.org',
  'https://b.pool.opentimestamps.org',
  'https://alice.btc.calendar.opentimestamps.org',
]

const ACCEPT = 'application/vnd.opentimestamps.v1'

export type OtsErrorCode =
  | 'invalid_digest'
  | 'no_calendars'
  | 'all_calendars_failed'
  | 'http_error'
  | 'empty_response'
  | 'malformed_proof'
  | 'unsupported_op'

export interface OtsAttempt {
  calendar: string
  status?: number
  error?: string
}

export class OtsError extends Error {
  override readonly name = 'OtsError'
  readonly code: OtsErrorCode
  readonly attempts: readonly OtsAttempt[]

  constructor(code: OtsErrorCode, message: string, attempts: readonly OtsAttempt[] = []) {
    super(message)
    this.code = code
    this.attempts = attempts
  }
}

export interface OtsProof {
  /** Base URL of the calendar that answered. */
  calendar: string
  /** The calendar's response bytes, stored verbatim. */
  proof: Uint8Array
}

export interface OtsClientOptions {
  calendars?: readonly string[]
  fetchImpl?: typeof fetch
}

const normaliseDigest = (digestHex: string): string => {
  const lower = digestHex.toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(lower)) {
    throw new OtsError(
      'invalid_digest',
      `digest must be 32 bytes as 64 hex chars, got ${JSON.stringify(digestHex)}`,
    )
  }
  return lower
}

/** Commitments are arbitrary-length byte strings (the calendar prepends/appends to the digest). */
const normaliseHex = (hex: string): string => {
  const lower = hex.toLowerCase()
  if (lower.length === 0 || lower.length % 2 !== 0 || !/^[0-9a-f]*$/.test(lower)) {
    throw new OtsError(
      'invalid_digest',
      `expected a non-empty even-length hex string, got ${JSON.stringify(hex)}`,
    )
  }
  return lower
}

const stripSlash = (url: string): string => url.replace(/\/+$/, '')

const describeError = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/** POST a digest to one calendar. Throws OtsError on any non-2xx or empty response. */
export const stampDigest = async (
  calendarUrl: string,
  digestHex: string,
  fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args),
): Promise<Uint8Array> => {
  const digest = normaliseDigest(digestHex)
  const calendar = stripSlash(calendarUrl)
  const res = await fetchImpl(`${calendar}/digest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: ACCEPT },
    body: asBufferSource(hexToBytes(digest)),
  })
  if (!res.ok) {
    throw new OtsError('http_error', `${calendar}/digest responded ${res.status}`, [
      { calendar, status: res.status },
    ])
  }
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length === 0) {
    throw new OtsError('empty_response', `${calendar}/digest returned an empty body`, [
      { calendar, status: res.status },
    ])
  }
  return bytes
}

/**
 * GET the upgraded timestamp for a commitment from one calendar. The commitment is the message
 * right before the PENDING attestation (see `parseAttestations`), which is generally longer
 * than 32 bytes, so any even-length hex is accepted.
 * Returns null on 404 (not yet anchored / unknown). Throws OtsError on other failures.
 */
export const getUpgrade = async (
  calendarUrl: string,
  commitmentHex: string,
  fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args),
): Promise<Uint8Array | null> => {
  const commitment = normaliseHex(commitmentHex)
  const calendar = stripSlash(calendarUrl)
  const res = await fetchImpl(`${calendar}/timestamp/${commitment}`, {
    method: 'GET',
    headers: { Accept: ACCEPT },
  })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new OtsError('http_error', `${calendar}/timestamp responded ${res.status}`, [
      { calendar, status: res.status },
    ])
  }
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length === 0) {
    throw new OtsError('empty_response', `${calendar}/timestamp returned an empty body`, [
      { calendar, status: res.status },
    ])
  }
  return bytes
}

export class OtsClient {
  readonly calendars: readonly string[]
  private readonly fetchImpl: typeof fetch

  constructor(options: OtsClientOptions = {}) {
    this.calendars = (options.calendars ?? DEFAULT_CALENDARS).map(stripSlash)
    // Wrap rather than store globalThis.fetch directly so browsers do not see an
    // "Illegal invocation" when it is called as a method of this instance.
    this.fetchImpl = options.fetchImpl ?? ((...args) => globalThis.fetch(...args))
  }

  /** Try each calendar in order; return the first successful response. */
  async stamp(digestHex: string): Promise<OtsProof> {
    const digest = normaliseDigest(digestHex)
    if (this.calendars.length === 0) throw new OtsError('no_calendars', 'no calendars configured')

    const attempts: OtsAttempt[] = []
    for (const calendar of this.calendars) {
      try {
        const proof = await stampDigest(calendar, digest, this.fetchImpl)
        return { calendar, proof }
      } catch (err) {
        if (err instanceof OtsError && err.attempts.length > 0) attempts.push(...err.attempts)
        else attempts.push({ calendar, error: describeError(err) })
      }
    }
    throw new OtsError(
      'all_calendars_failed',
      `all ${this.calendars.length} calendars failed to stamp ${digest}`,
      attempts,
    )
  }

  /**
   * Ask for the Bitcoin-anchored continuation of a timestamp.
   *
   * With `proof` (the bytes returned by `stamp`), the pending attestations inside it are
   * walked to recover each calendar URI and its commitment, and those are queried. Without it,
   * `digestHex` is queried as-is on every configured calendar — only useful when the caller
   * already holds the commitment digest rather than the original one.
   *
   * Returns null when every calendar answers 404 (still pending). Throws OtsError only if a
   * calendar fails in some other way and none succeeded.
   */
  async upgrade(digestHex: string, proof?: Uint8Array): Promise<OtsProof | null> {
    const digest = proof ? normaliseDigest(digestHex) : normaliseHex(digestHex)
    const targets: { calendar: string; commitment: string }[] = proof
      ? (await parseAttestations(digest, proof))
          .filter((a): a is PendingAttestation => a.kind === 'pending')
          .map((a) => ({ calendar: stripSlash(a.uri), commitment: a.commitment }))
      : this.calendars.map((calendar) => ({ calendar, commitment: digest }))

    if (targets.length === 0) throw new OtsError('no_calendars', 'no calendars to query')

    const attempts: OtsAttempt[] = []
    for (const { calendar, commitment } of targets) {
      try {
        const upgraded = await getUpgrade(calendar, commitment, this.fetchImpl)
        if (upgraded) return { calendar, proof: upgraded }
        attempts.push({ calendar, status: 404 })
      } catch (err) {
        if (err instanceof OtsError && err.attempts.length > 0) attempts.push(...err.attempts)
        else attempts.push({ calendar, error: describeError(err) })
      }
    }
    if (attempts.every((a) => a.status === 404)) return null
    throw new OtsError(
      'all_calendars_failed',
      `all ${targets.length} calendars failed to upgrade ${digest}`,
      attempts,
    )
  }
}

// ---------------------------------------------------------------------------------------------
// Minimal reader for the serialized timestamp encoding. Enough to find commitments; nothing more.
// ---------------------------------------------------------------------------------------------

const OP_SHA1 = 0x02
const OP_RIPEMD160 = 0x03
const OP_SHA256 = 0x08
const OP_KECCAK256 = 0x67
const OP_APPEND = 0xf0
const OP_PREPEND = 0xf1
const OP_REVERSE = 0xf2
const OP_HEXLIFY = 0xf3
const ATTESTATION = 0x00
const FORK = 0xff

const TAG_PENDING = '83dfe30d2ef90c8e'
const TAG_BITCOIN = '0588960d73d71901'

export interface PendingAttestation {
  kind: 'pending'
  uri: string
  /** Hex digest the calendar keys this timestamp on. */
  commitment: string
}
export interface BitcoinAttestation {
  kind: 'bitcoin'
  height: number
  commitment: string
}
export interface UnknownAttestation {
  kind: 'unknown'
  tag: string
  commitment: string
}
export type Attestation = PendingAttestation | BitcoinAttestation | UnknownAttestation

class Reader {
  pos = 0
  constructor(private readonly buf: Uint8Array) {}

  get done(): boolean {
    return this.pos >= this.buf.length
  }

  byte(): number {
    const b = this.buf[this.pos]
    if (b === undefined)
      throw new OtsError('malformed_proof', `unexpected end of proof at ${this.pos}`)
    this.pos += 1
    return b
  }

  bytes(n: number): Uint8Array {
    if (this.pos + n > this.buf.length) {
      throw new OtsError(
        'malformed_proof',
        `unexpected end of proof reading ${n} bytes at ${this.pos}`,
      )
    }
    const out = this.buf.slice(this.pos, this.pos + n)
    this.pos += n
    return out
  }

  varuint(): number {
    let value = 0
    let shift = 0
    for (;;) {
      const b = this.byte()
      value += (b & 0x7f) * 2 ** shift
      if ((b & 0x80) === 0) return value
      shift += 7
      if (shift > 49) throw new OtsError('malformed_proof', 'varuint too large')
    }
  }

  varbytes(): Uint8Array {
    return this.bytes(this.varuint())
  }
}

const concat = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

const applyOp = async (tag: number, msg: Uint8Array, r: Reader): Promise<Uint8Array> => {
  switch (tag) {
    case OP_APPEND:
      return concat(msg, r.varbytes())
    case OP_PREPEND:
      return concat(r.varbytes(), msg)
    case OP_REVERSE:
      return msg.slice().reverse()
    case OP_HEXLIFY:
      return new TextEncoder().encode(bytesToHex(msg))
    case OP_SHA256:
      return sha256Bytes(msg)
    case OP_SHA1:
      return new Uint8Array(await crypto.subtle.digest('SHA-1', asBufferSource(msg)))
    case OP_RIPEMD160:
    case OP_KECCAK256:
      throw new OtsError(
        'unsupported_op',
        `op 0x${tag.toString(16)} is not available in Web Crypto; use the ots CLI`,
      )
    default:
      throw new OtsError('malformed_proof', `unknown op tag 0x${tag.toString(16)}`)
  }
}

const readAttestation = (r: Reader, commitment: string): Attestation => {
  const tag = bytesToHex(r.bytes(8))
  const payload = new Reader(r.varbytes())
  if (tag === TAG_PENDING) {
    const uri = new TextDecoder().decode(payload.varbytes())
    return { kind: 'pending', uri, commitment }
  }
  if (tag === TAG_BITCOIN) return { kind: 'bitcoin', height: payload.varuint(), commitment }
  return { kind: 'unknown', tag, commitment }
}

const walk = async (r: Reader, msg: Uint8Array, out: Attestation[]): Promise<void> => {
  for (;;) {
    const tag = r.byte()
    if (tag === ATTESTATION) {
      out.push(readAttestation(r, bytesToHex(msg)))
      return
    }
    if (tag === FORK) {
      await walk(r, msg, out)
      continue
    }
    msg = await applyOp(tag, msg, r)
  }
}

/**
 * Walk a serialized timestamp (as returned by a calendar for `digestHex`) and list every
 * attestation together with the commitment digest it attests to.
 */
export const parseAttestations = async (
  digestHex: string,
  proof: Uint8Array,
): Promise<Attestation[]> => {
  const r = new Reader(proof)
  const out: Attestation[] = []
  await walk(r, hexToBytes(normaliseDigest(digestHex)), out)
  if (!r.done)
    throw new OtsError('malformed_proof', `${proof.length - r.pos} trailing bytes in proof`)
  return out
}
