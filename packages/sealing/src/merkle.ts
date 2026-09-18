/**
 * A pure Merkle tree over an ordered list of hex-encoded SHA-256 leaf hashes.
 *
 * - Internal node = SHA-256(left || right) over the raw 32-byte digests, not the hex strings.
 * - An odd node count duplicates the last node (Bitcoin-style).
 * - A single leaf is its own root.
 *
 * Uses Web Crypto (`crypto.subtle`) only, so it runs on Node 22 and edge runtimes alike.
 * Every function that hashes is therefore async.
 */

export interface ProofStep {
  /** Where the sibling sits relative to the node being proven. */
  position: 'left' | 'right'
  /** Hex SHA-256 of the sibling node. */
  hash: string
}

export type InclusionProof = ProofStep[]

export interface MerkleTree {
  /** Hex SHA-256 root. */
  root: string
  /** layers[0] is the leaves in input order; the last layer holds exactly the root. */
  layers: string[][]
}

const HEX_DIGEST = /^[0-9a-f]{64}$/

export const isHexDigest = (value: string): boolean => HEX_DIGEST.test(value)

export const hexToBytes = (hex: string): Uint8Array => {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error(`invalid hex string: ${JSON.stringify(hex)}`)
  }
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

/** Copy into a fresh ArrayBuffer-backed view so the DOM lib's BufferSource type is satisfied. */
export const asBufferSource = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength))
  copy.set(bytes)
  return copy
}

export const sha256Bytes = async (bytes: Uint8Array): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', asBufferSource(bytes)))

const assertDigest = (value: string, what: string): void => {
  if (!isHexDigest(value)) {
    throw new Error(
      `${what} must be a lowercase 64-char hex SHA-256 digest, got ${JSON.stringify(value)}`,
    )
  }
}

/** SHA-256 over the concatenated raw bytes of two hex digests. */
export const hashPair = async (left: string, right: string): Promise<string> => {
  assertDigest(left, 'left')
  assertDigest(right, 'right')
  const buf = new Uint8Array(64)
  buf.set(hexToBytes(left), 0)
  buf.set(hexToBytes(right), 32)
  return bytesToHex(await sha256Bytes(buf))
}

export const buildMerkleTree = async (leaves: readonly string[]): Promise<MerkleTree> => {
  if (leaves.length === 0) throw new Error('cannot build a Merkle tree with no leaves')
  for (const leaf of leaves) assertDigest(leaf, 'leaf')

  const layers: string[][] = [[...leaves]]
  let current = layers[0] as string[]
  while (current.length > 1) {
    const next: string[] = []
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i] as string
      // Odd count: the last node is paired with itself.
      const right = current[i + 1] ?? left
      next.push(await hashPair(left, right))
    }
    layers.push(next)
    current = next
  }
  return { root: current[0] as string, layers }
}

/** Sibling path from leaf `index` to the root. For a single-leaf tree the proof is empty. */
export const inclusionProof = (
  layers: readonly (readonly string[])[],
  index: number,
): InclusionProof => {
  const leaves = layers[0]
  if (!leaves || leaves.length === 0) throw new Error('layers must contain at least one leaf')
  if (!Number.isInteger(index) || index < 0 || index >= leaves.length) {
    throw new RangeError(`leaf index ${index} out of range [0, ${leaves.length})`)
  }
  const proof: InclusionProof = []
  let i = index
  for (let level = 0; level < layers.length - 1; level++) {
    const layer = layers[level] as readonly string[]
    const siblingIndex = i % 2 === 0 ? i + 1 : i - 1
    // Past the end of an odd layer the node was duplicated, so it is its own sibling.
    const sibling = layer[siblingIndex] ?? (layer[i] as string)
    proof.push({ position: i % 2 === 0 ? 'right' : 'left', hash: sibling })
    i = Math.floor(i / 2)
  }
  return proof
}

export const verifyInclusion = async (
  leaf: string,
  proof: InclusionProof,
  root: string,
): Promise<boolean> => {
  if (!isHexDigest(leaf) || !isHexDigest(root)) return false
  let acc = leaf
  for (const step of proof) {
    if (!isHexDigest(step.hash)) return false
    acc = step.position === 'left' ? await hashPair(step.hash, acc) : await hashPair(acc, step.hash)
  }
  return acc === root
}
