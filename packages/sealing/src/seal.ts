import { buildMerkleTree, inclusionProof, type InclusionProof } from './merkle'
import type { OtsClient, OtsProof } from './opentimestamps'

export interface SealedDay {
  /** Hex Merkle root over the day's commitment hashes, in the order given. */
  root: string
  leafCount: number
  /** Leaf index -> sibling path to the root. */
  proofs: Map<number, InclusionProof>
  /** Calendar response for the root, stored verbatim. */
  ots: OtsProof
}

/**
 * Seal one day's commitments: build the Merkle tree over their hashes, stamp the root with
 * OpenTimestamps, and hand back an inclusion proof per leaf.
 *
 * Deterministic given the leaf order: the same ordered leaves always produce the same root and
 * proofs. Only the `ots` bytes depend on the calendar's nonce.
 */
export const sealDay = async (
  leaves: readonly string[],
  ots: Pick<OtsClient, 'stamp'>,
): Promise<SealedDay> => {
  const tree = await buildMerkleTree(leaves)
  const proofs = new Map<number, InclusionProof>()
  for (let i = 0; i < leaves.length; i++) proofs.set(i, inclusionProof(tree.layers, i))
  const stamped = await ots.stamp(tree.root)
  return { root: tree.root, leafCount: leaves.length, proofs, ots: stamped }
}
