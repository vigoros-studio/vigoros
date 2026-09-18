import { count, eq } from 'drizzle-orm'
import { assets, methodologyVersions, participants, publishers, universeVersions } from '@vigoros/db'
import { METHODOLOGY_VERSION, newId, type AssetClass, type VenueId } from '@vigoros/domain'
import universeJson from '@vigoros/questions/universe-v1'
import type { JobContext, ReferenceModelConfig } from './context.js'

interface UniverseRow {
  symbol: string
  venue: VenueId
  assetClass: AssetClass
  name: string
  peerGroup: string
  vendorSymbol: string
}

export const VIGOROS_PUBLISHER_EMAIL = 'reference@vigoros.studio'

export const REFERENCE_MODELS: { handle: string; displayName: string; config: ReferenceModelConfig }[] = [
  { handle: 'claude-opus-5', displayName: 'Claude Opus 5', config: { provider: 'anthropic', model: 'claude-opus-5', promptVersion: 'v1.0', effort: 'medium' } },
  { handle: 'gpt-5', displayName: 'GPT-5', config: { provider: 'openai', model: 'gpt-5', promptVersion: 'v1.0' } },
  { handle: 'deepseek-v3', displayName: 'DeepSeek V3', config: { provider: 'deepseek', model: 'deepseek-chat', promptVersion: 'v1.0' } },
]

export const BASELINES: { handle: string; displayName: string; strategy: string }[] = [
  { handle: 'baseline-prior', displayName: 'Base rate', strategy: 'prior' },
  { handle: 'baseline-momentum', displayName: 'Momentum', strategy: 'momentum' },
  { handle: 'baseline-mean-reversion', displayName: 'Mean reversion', strategy: 'mean_reversion' },
  { handle: 'baseline-random', displayName: 'Random', strategy: 'random' },
]

/** Idempotent. Creates methodology, universe v1, assets, the Vigoros publisher and reference identities. */
export const seedReferenceData = async (ctx: JobContext): Promise<{ assets: number; participants: number }> => {
  await ctx.db
    .insert(methodologyVersions)
    .values({ version: METHODOLOGY_VERSION, effectiveFrom: '2026-09-18', announcedAt: new Date('2026-09-18T00:00:00Z'), docUrl: 'https://vigoros.studio/methodology' })
    .onConflictDoNothing()

  let [uv] = await ctx.db.select().from(universeVersions).where(eq(universeVersions.effectiveFrom, '2026-09-18'))
  if (!uv) [uv] = await ctx.db.insert(universeVersions).values({ effectiveFrom: '2026-09-18', note: 'v1: S&P 500, FTSE 100, major ETFs, G10 FX, BTC/ETH/SOL' }).returning()
  if (!uv) throw new Error('failed to create universe version')

  const rows = (universeJson as UniverseRow[]).map((a) => ({
    id: newId(),
    symbol: a.symbol,
    venue: a.venue,
    assetClass: a.assetClass,
    name: a.name,
    peerGroup: a.peerGroup,
    vendorSymbol: a.vendorSymbol,
    activeFrom: uv.id,
  }))
  for (let i = 0; i < rows.length; i += 200) {
    await ctx.db.insert(assets).values(rows.slice(i, i + 200)).onConflictDoNothing({ target: [assets.symbol, assets.venue] })
  }

  let [pub] = await ctx.db.select().from(publishers).where(eq(publishers.email, VIGOROS_PUBLISHER_EMAIL))
  if (!pub) {
    ;[pub] = await ctx.db
      .insert(publishers)
      .values({ id: newId(), authUserId: 'system:vigoros', email: VIGOROS_PUBLISHER_EMAIL, displayName: 'Vigoros reference', verifiedAt: new Date() })
      .returning()
  }
  if (!pub) throw new Error('failed to create publisher')

  const participantRows = [
    ...REFERENCE_MODELS.map((m) => ({ id: newId(), publisherId: pub.id, kind: 'REFERENCE_MODEL' as const, handle: m.handle, displayName: m.displayName, visibility: 'PUBLISHED' as const, publishedAt: new Date(), config: m.config })),
    ...BASELINES.map((b) => ({ id: newId(), publisherId: pub.id, kind: 'BASELINE' as const, handle: b.handle, displayName: b.displayName, visibility: 'PUBLISHED' as const, publishedAt: new Date(), config: { strategy: b.strategy } })),
  ]
  await ctx.db.insert(participants).values(participantRows).onConflictDoNothing({ target: participants.handle })

  const [countRow] = await ctx.db.select({ n: count() }).from(assets)
  return { assets: countRow?.n ?? 0, participants: participantRows.length }
}
