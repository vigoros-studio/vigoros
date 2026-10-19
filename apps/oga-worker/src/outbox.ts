import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { ContentDraft, Publication, Surface } from '@vigoros/contracts'

/**
 * The outbox: the only place the worker writes. One folder per surface, one markdown file and
 * one JSON sidecar per piece, named by date and slug. The founder publishes from here by hand
 * (or a later job does, after its own approval). Nothing is ever deleted.
 */
export const writeToOutbox = (
  root: string,
  surface: Surface,
  slug: string,
  draft: ContentDraft,
  body: string,
  meta: Record<string, unknown>,
): Publication => {
  const dir = path.join(root, surface)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const day = new Date().toISOString().slice(0, 10)
  const base = `${day}-${slug}`
  const md = path.join(dir, `${base}.md`)
  const front = [
    '---',
    `title: ${JSON.stringify(draft.title)}`,
    `surface: ${surface}`,
    `audience: ${draft.audience}`,
    `methodology_version: ${draft.methodologyVersion}`,
    `summary: ${JSON.stringify(draft.summary)}`,
    draft.callToAction ? `call_to_action: ${JSON.stringify(draft.callToAction)}` : null,
    draft.hashtags.length ? `hashtags: [${draft.hashtags.join(', ')}]` : null,
    draft.withheld ? `withheld: ${JSON.stringify(draft.withheld.reason)}` : null,
    `citations: ${draft.citations.length}`,
    '---',
  ]
    .filter(Boolean)
    .join('\n')
  const citations = draft.citations.length
    ? `\n\n## Sources\n\n${draft.citations
        .map(
          (c) =>
            `- ${c.signalKey} · ${c.placeName} (${c.placeId}) · ${c.value}${c.unit ? ` ${c.unit}` : ''} · ${c.periodStart} to ${c.periodEnd} · ${c.source} · confidence ${c.confidence} · methodology ${c.methodologyVersion}`,
        )
        .join('\n')}`
    : ''
  const text = `${front}\n\n# ${draft.title}\n\n${body.trim()}${citations}\n`
  writeFileSync(md, text, { flag: 'wx' })
  writeFileSync(
    path.join(dir, `${base}.json`),
    JSON.stringify({ ...meta, draft, body, writtenAt: new Date().toISOString() }, null, 2),
    { flag: 'wx' },
  )
  const bytes = Buffer.byteLength(text)
  return {
    surface,
    slug,
    path: md,
    bytes,
    sha256: createHash('sha256').update(text).digest('hex'),
    publishedAt: new Date().toISOString(),
  }
}
