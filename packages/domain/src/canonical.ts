/**
 * RFC 8785 (JSON Canonicalization Scheme) subset sufficient for our payloads:
 * objects with sorted keys, no whitespace, numbers in ES6 shortest form, strings JSON-escaped.
 * Deterministic bytes in, deterministic hash out. Used for every sealed commitment.
 */
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

export const canonicalize = (value: Json): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non-finite number cannot be canonicalized')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k] as Json)}`).join(',')}}`
}

const encoder = new TextEncoder()

export const sha256Hex = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export const hashCanonical = (value: Json): Promise<string> => sha256Hex(canonicalize(value))
