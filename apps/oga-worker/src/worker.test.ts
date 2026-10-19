import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ContentDraft, ResearchPack } from '@vigoros/contracts'
import { describe, expect, it } from 'vitest'
import { writeToOutbox } from './outbox'
import { samplePack, sampleScoreboard } from './sample'

describe('sample pack', () => {
  it('serves the two sample postcodes, labelled as sample, and invents nothing for others', () => {
    const pack = samplePack(['SE15 5DP', 'LA22 0EN', 'SW1A 1AA'])
    expect(ResearchPack.parse(pack).mode).toBe('sample')
    expect(pack.places.map((p) => p.input)).toEqual(['SE15 5DP', 'LA22 0EN'])
    expect(pack.notes.some((n) => n.startsWith('SW1A 1AA: not in the sample pack'))).toBe(true)
    const peckham = pack.places[0]!
    const median = peckham.signals.find((s) => s.key === 'property.median_price')!
    expect(median.value).toBe(500000)
    expect(median.confidence).toBe(90)
    expect(median.periodEnd).toBe('2026-03-31')
  })
  it('scoreboard is the 11 October figures and says it did not read PostHog', () => {
    const b = sampleScoreboard()
    expect(b.site['visitors30d']).toBe(282)
    expect(b.notes[0]).toContain('SAMPLE MODE')
  })
})

describe('outbox', () => {
  it('writes one markdown and one json file per piece, never overwrites, and lists every citation', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'oga-outbox-'))
    const draft = ContentDraft.parse({
      surface: 'linkedin',
      title: 'One figure',
      audience: 'location_data',
      summary: 'A test.',
      body: 'Peckham records 731.9 crimes per 1,000 residents.',
      citations: [
        {
          signalKey: 'crime.rate_per_1000',
          placeId: 'oga_pl_YXC6XP2HFFQEA',
          placeName: 'Peckham',
          value: '731.9',
          unit: 'per 1,000 residents',
          periodStart: '2025-09-01',
          periodEnd: '2026-08-31',
          source: 'police.uk and ONS Census 2021',
          confidence: 100,
          methodologyVersion: '1.12.5',
        },
      ],
      methodologyVersion: '1.12.5',
      callToAction: null,
      hashtags: ['placedata'],
      withheld: null,
    })
    const pub = writeToOutbox(root, 'linkedin', 'one-figure', draft, draft.body, { test: true })
    expect(pub.path.endsWith('one-figure.md')).toBe(true)
    const text = readFileSync(pub.path, 'utf8')
    expect(text).toContain('methodology_version: 1.12.5')
    expect(text).toContain('crime.rate_per_1000')
    expect(readdirSync(path.join(root, 'linkedin'))).toHaveLength(2)
    expect(() => writeToOutbox(root, 'linkedin', 'one-figure', draft, draft.body, {})).toThrow()
  })
})
