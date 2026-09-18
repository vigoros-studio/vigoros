import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { commitments, sealRoots } from '@vigoros/db'
import { newId } from '@vigoros/domain'
import { sealDay } from '@vigoros/sealing'
import type { JobContext } from './context'

/**
 * Seal every commitment not yet in a Merkle root. Leaves are ordered by commitment id (ULID,
 * so by submission time), the root is anchored through OpenTimestamps, and each commitment
 * receives its inclusion proof. Safe to re-run: only unsealed rows are picked up.
 */
export const sealPending = async (ctx: JobContext, sealDate: string): Promise<{ sealed: number; root: string | null }> => {
  const pending = await ctx.db
    .select({ id: commitments.id, hash: commitments.hash })
    .from(commitments)
    .where(and(isNull(commitments.sealRootId), sql`${commitments.submittedAt} < now()`))
    .orderBy(commitments.id)
    .limit(50_000)
  if (pending.length === 0) return { sealed: 0, root: null }

  const result = await sealDay(pending.map((p) => p.hash), ctx.ots)
  const rootId = newId(ctx.now())
  await ctx.db.transaction(async (tx) => {
    await tx.insert(sealRoots).values({
      id: rootId,
      sealDate,
      merkleRoot: result.root,
      leafCount: result.leafCount,
      otsProof: result.ots.proof,
      anchoredAt: null,
    })
    // Batched proof writes: one UPDATE per 500 rows using a VALUES join.
    for (let i = 0; i < pending.length; i += 500) {
      const chunk = pending.slice(i, i + 500)
      for (const [offset, c] of chunk.entries()) {
        const proof = result.proofs.get(i + offset)
        await tx
          .update(commitments)
          .set({ sealRootId: rootId, inclusionProof: proof ?? null })
          .where(eq(commitments.id, c.id))
      }
    }
  })
  ctx.log.info('sealed', { sealDate, count: pending.length, root: result.root, calendar: result.ots.calendar })
  return { sealed: pending.length, root: result.root }
}

/** Try to upgrade pending OTS proofs to Bitcoin-attested ones. */
export const upgradeSeals = async (ctx: JobContext): Promise<number> => {
  const rows = await ctx.db
    .select({ id: sealRoots.id, root: sealRoots.merkleRoot, proof: sealRoots.otsProof })
    .from(sealRoots)
    .where(isNull(sealRoots.anchoredAt))
    .limit(50)
  let upgraded = 0
  for (const r of rows) {
    if (!r.proof) continue
    // The calendar keys upgrades on its own commitment, recovered from the stored proof.
    const up = await ctx.ots.upgrade(r.root, r.proof)
    if (!up) continue
    await ctx.db.update(sealRoots).set({ otsProof: up.proof, anchoredAt: ctx.now() }).where(eq(sealRoots.id, r.id))
    upgraded++
  }
  return upgraded
}

/** Reveal commitments whose questions have resolved. Called from the resolver. */
export const revealFor = async (ctx: JobContext, questionIds: string[]): Promise<number> => {
  if (questionIds.length === 0) return 0
  let n = 0
  for (let i = 0; i < questionIds.length; i += 500) {
    const r = await ctx.db
      .update(commitments)
      .set({ revealedAt: ctx.now() })
      .where(and(inArray(commitments.questionId, questionIds.slice(i, i + 500)), isNull(commitments.revealedAt)))
      .returning({ id: commitments.id })
    n += r.length
  }
  return n
}
