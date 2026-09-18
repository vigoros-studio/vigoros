import { sha256Hex } from '@vigoros/domain'
import { describe, expect, it } from 'vitest'
import {
  buildMerkleTree,
  bytesToHex,
  hashPair,
  hexToBytes,
  inclusionProof,
  verifyInclusion,
} from './merkle.js'

const leaves = async (n: number): Promise<string[]> =>
  Promise.all(Array.from({ length: n }, (_, i) => sha256Hex(`leaf-${i}`)))

// Roots for sha256("leaf-0") .. sha256("leaf-{n-1}"), computed independently with Node's
// Web Crypto and the same pairing rule. Any change to the hashing or duplication rule breaks these.
const EXPECTED_ROOTS: Record<number, string> = {
  1: 'd2dbf006f96dd05044a8f63d8f118f23925ba4cc5750f8b6c8e287fd506c8188',
  2: '8b0f563106070048a1057926820c7118dec20b8a73715544f4528487c16dc0d7',
  3: '39313694557e76d28b720ad7f4481cb144c24c8341f8a68fc4a8363fcd1a04bb',
  4: '476c4a255bbaa3fa397182c77cb1bc85be71aa10349349f67e5c2bdd0453bfa0',
  5: '3ad4abec5d43ae09f5275cf7ce77d8615e1e87164b255aa7661e237b1982a5bf',
}

describe('hex helpers', () => {
  it('round-trips bytes', () => {
    const hex = '00ff10a5'
    expect(bytesToHex(hexToBytes(hex))).toBe(hex)
  })
  it('rejects odd-length or non-hex input', () => {
    expect(() => hexToBytes('abc')).toThrow()
    expect(() => hexToBytes('zz')).toThrow()
  })
})

describe('buildMerkleTree', () => {
  it('rejects empty input', async () => {
    await expect(buildMerkleTree([])).rejects.toThrow(/no leaves/)
  })

  it('rejects leaves that are not 32-byte hex digests', async () => {
    await expect(buildMerkleTree(['abc'])).rejects.toThrow(/leaf/)
    await expect(buildMerkleTree(['A'.repeat(64)])).rejects.toThrow(/leaf/)
  })

  it('a single leaf is its own root with one layer', async () => {
    const [a] = await leaves(1)
    const tree = await buildMerkleTree([a as string])
    expect(tree.root).toBe(a)
    expect(tree.layers).toEqual([[a]])
  })

  it.each([1, 2, 3, 4, 5])('root for %i leaves is stable', async (n) => {
    const ls = await leaves(n)
    const tree = await buildMerkleTree(ls)
    expect(tree.root).toBe(EXPECTED_ROOTS[n])
    // Determinism: rebuilding gives the identical structure.
    expect(await buildMerkleTree(ls)).toEqual(tree)
    // Every leaf verifies against the hardcoded root.
    for (let i = 0; i < n; i++) {
      expect(
        await verifyInclusion(ls[i] as string, inclusionProof(tree.layers, i), tree.root),
      ).toBe(true)
    }
  })

  it('hashes internal nodes over raw bytes, not hex strings', async () => {
    const [a, b] = (await leaves(2)) as [string, string]
    const tree = await buildMerkleTree([a, b])
    const raw = new Uint8Array([...hexToBytes(a), ...hexToBytes(b)])
    const rawHash = bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)))
    expect(tree.root).toBe(rawHash)
    expect(tree.root).not.toBe(await sha256Hex(a + b))
  })

  it('duplicates the last node on odd layers (3 leaves)', async () => {
    const [a, b, c] = (await leaves(3)) as [string, string, string]
    const tree = await buildMerkleTree([a, b, c])
    const ab = await hashPair(a, b)
    const cc = await hashPair(c, c)
    expect(tree.layers).toEqual([[a, b, c], [ab, cc], [await hashPair(ab, cc)]])
    // Duplicating is not the same as promoting c unchanged.
    expect(tree.root).not.toBe(await hashPair(ab, c))
  })

  it('duplicates at a higher layer too (5 leaves)', async () => {
    const ls = (await leaves(5)) as [string, string, string, string, string]
    const tree = await buildMerkleTree(ls)
    const l1 = [
      await hashPair(ls[0], ls[1]),
      await hashPair(ls[2], ls[3]),
      await hashPair(ls[4], ls[4]),
    ] as [string, string, string]
    const l2 = [await hashPair(l1[0], l1[1]), await hashPair(l1[2], l1[2])] as [string, string]
    expect(tree.layers).toEqual([ls, l1, l2, [await hashPair(l2[0], l2[1])]])
    expect(tree.layers.length).toBe(4)
  })

  it('leaf order matters', async () => {
    const ls = await leaves(4)
    const a = await buildMerkleTree(ls)
    const b = await buildMerkleTree([...ls].reverse())
    expect(a.root).not.toBe(b.root)
  })
})

describe('inclusionProof / verifyInclusion', () => {
  it('proof for a single leaf is empty and verifies', async () => {
    const [a] = (await leaves(1)) as [string]
    const tree = await buildMerkleTree([a])
    const proof = inclusionProof(tree.layers, 0)
    expect(proof).toEqual([])
    expect(await verifyInclusion(a, proof, tree.root)).toBe(true)
  })

  it('proof length equals tree height and self-sibling appears for the odd tail', async () => {
    const ls = await leaves(5)
    const tree = await buildMerkleTree(ls)
    const last = inclusionProof(tree.layers, 4)
    expect(last).toHaveLength(3)
    expect(last[0]).toEqual({ position: 'right', hash: ls[4] })
    expect(last[1]).toEqual({ position: 'right', hash: tree.layers[1]?.[2] })
    expect(last[2]).toEqual({ position: 'left', hash: tree.layers[2]?.[0] })
  })

  it('every proof verifies for 1..9 leaves', async () => {
    for (let n = 1; n <= 9; n++) {
      const ls = await leaves(n)
      const tree = await buildMerkleTree(ls)
      for (let i = 0; i < n; i++) {
        expect(
          await verifyInclusion(ls[i] as string, inclusionProof(tree.layers, i), tree.root),
        ).toBe(true)
      }
    }
  })

  it('a tampered leaf fails', async () => {
    const ls = await leaves(5)
    const tree = await buildMerkleTree(ls)
    const proof = inclusionProof(tree.layers, 2)
    const tampered = await sha256Hex('leaf-2-tampered')
    expect(await verifyInclusion(tampered, proof, tree.root)).toBe(false)
  })

  it('a proof for one leaf does not verify another leaf', async () => {
    const ls = await leaves(4)
    const tree = await buildMerkleTree(ls)
    expect(await verifyInclusion(ls[1] as string, inclusionProof(tree.layers, 0), tree.root)).toBe(
      false,
    )
  })

  it('a tampered proof step or wrong root fails', async () => {
    const ls = await leaves(4)
    const tree = await buildMerkleTree(ls)
    const proof = inclusionProof(tree.layers, 3)
    const flipped = proof.map((s, i) =>
      i === 0
        ? { ...s, position: s.position === 'left' ? ('right' as const) : ('left' as const) }
        : s,
    )
    expect(await verifyInclusion(ls[3] as string, flipped, tree.root)).toBe(false)
    expect(await verifyInclusion(ls[3] as string, proof, await sha256Hex('nope'))).toBe(false)
    expect(await verifyInclusion(ls[3] as string, proof, 'not-hex')).toBe(false)
  })

  it('rejects out-of-range indices', async () => {
    const tree = await buildMerkleTree(await leaves(3))
    expect(() => inclusionProof(tree.layers, 3)).toThrow(RangeError)
    expect(() => inclusionProof(tree.layers, -1)).toThrow(RangeError)
    expect(() => inclusionProof(tree.layers, 1.5)).toThrow(RangeError)
    expect(() => inclusionProof([], 0)).toThrow()
  })
})
